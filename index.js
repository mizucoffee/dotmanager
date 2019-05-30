const config = require('config')
const {
  google
} = require('googleapis')
const fs = require('fs-extra')
const path = require('path')
const {
  prompt
} = require('enquirer')
const puppeteer = require('puppeteer')
const cron = require('node-cron')
const moment = require('moment-timezone')
const request = require('request')

if (!fs.pathExistsSync('credentials.json')) {
  console.error('ERROR: credentials.jsonが見つかりません。READMEを参考に入手してください。')
  process.exit(1)
}
const credentials = JSON.parse(fs.readFileSync('credentials.json'))
const {
  client_secret,
  client_id,
  redirect_uris
} = credentials.installed

if(config.get('wirepusher') != "") {
  request('http://wirepusher.com/send?id=' + config.get('wirepusher') + '&title=dotManager&message=' + encodeURIComponent('dotManager起動時通知テストです。') + '%0A' + encodeURIComponent('正常に動作しています。この通知は無視してください。'))
}
if(config.get('ifttt.notification') != "") {
  request.post(config.get('ifttt.notification')).form({
    value1: 'dotCampus',
    value2: 'dotManager起動時通知テストです。\n正常に動作しています。この通知は無視してください。'
  })
}

main()

async function main() {
  await authorize()
  await sync()
}

async function sync() {

  const tasks = google.tasks({
    version: 'v1',
    auth: await refreshOAuth2Client()
  })

  if ((await tasks.tasklists.list()).data.items.filter(i => i.title == 'dotCampus').length == 0) {
    await tasks.tasklists.insert({
      resource: {
        title: 'dotCampus'
      }
    })
  }

  const tasklistId = (await tasks.tasklists.list()).data.items.filter(i => i.title == 'dotCampus')[0].id

  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  })
  const page = await browser.newPage();
  await page.setViewport({
    width: 1080,
    height: 1920
  })
  await page.goto(path.join(config.get('dotcampus.url'),'/'))

  const isLoggedIn = await page.evaluate(() => {
    const node = document.querySelectorAll("#buttonHtmlLogon");
    return node.length ? false : true;
  });

  if (!isLoggedIn) {
    await page.type('#TextLoginID', config.get('dotcampus.id'))
    await page.type('#TextPassword', config.get('dotcampus.password'))
    await page.click('#buttonHtmlLogon')
  }

  const data = await getList(page,false)

  let {items, nextPageToken} = (await tasks.tasks.list({
    tasklist: tasklistId,
    showCompleted: true,
    showDeleted: true,
    showHidden: true
  })).data

  items = items || []

  while(nextPageToken != undefined) {
    let data = (await tasks.tasks.list({
      tasklist: tasklistId,
      showCompleted: true,
      showDeleted: true,
      showHidden: true,
      pageToken: nextPageToken,
      maxResults: 5,
    })).data
    items = items.concat(data.items)
    nextPageToken = data.nextPageToken
  }

  const titles = items.map(e => e.title)
  const notes = items.map(e => e.notes)
  const added = []
  for (let i = 0; i < data.length; i++) {
    if (titles.indexOf(data[i].title) < 0 && notes.indexOf(data[i].notes) < 0) {
      added.push(data[i])
      if(config.get('ifttt.reminder') != "") {
        request.post(config.get('ifttt.reminder')).form({
          value1: `${data[i].title} - ${data[i].notes.split('\n')[0].split(':')[1]}`,
          value2: `${data[i].due.split('/')[0]}/${data[i].due.split('/')[1]}/${new Date().getFullYear()} at 11:59pm`
        })
      }
      await tasks.tasks.insert({
        tasklist: tasklistId,
        resource: {
          title: data[i].title,
          notes: data[i].notes,
          due: `${new Date().getFullYear()}-${data[i].due.split('/')[0]}-${data[i].due.split('/')[1]}T00:00:00.000000Z`
        }
      })
    }
  }

  if(added.length > 0 && config.get('wirepusher') != "") {
    request('http://wirepusher.com/send?id=' + config.get('wirepusher') + '&title=dotManager&message=' + encodeURIComponent('スケジュールが更新されました。') + '%0A' + encodeURIComponent('詳しくはTasksアプリで確認してください。'))
  }
  if(added.length > 0 && config.get('ifttt.notification') != "") {
    request.post(config.get('ifttt.notification')).form({
      value1: 'dotCampus',
      value2: 'スケジュールが更新されました。\n詳しくはTasksアプリで確認してください。'
    })
  }

  console.log('同期処理を実行しました:', moment(new Date()).tz("Asia/Tokyo").format())
  browser.close()
}

async function getList(page, isNext) {
  await page.goto(path.join(config.get('dotcampus.url'),'Portal/FullSchedule'))
  await new Promise(res => setTimeout(res, 5000))
  if(isNext) {
    await page.click('#fullschedule-next-button')
    await new Promise(res => setTimeout(res, 5000))
  }
  const list = await page.evaluate(() => {
    const l = document.querySelector('.fc-view-month>div').childNodes;
    let list = []
    l.forEach(e => {
      const rect = e.getBoundingClientRect()
      list.push({
        x: rect.x,
        y: rect.y
      })
    })
    return list
  })

  const data = []

  for (let i = 0; i < list.length; i++) {
    await page.mouse.move(list[i].x + 1, list[i].y + 1)
    await new Promise(res => setTimeout(res, 200))

    data.push(await page.evaluate(() => {
      const parent = document.getElementsByClassName('fullcalendar-tooltip')[0]
      return {
        title: parent.children[0].children[1].children[0].innerText,
        notes: parent.children[2].innerText,
        due: parent.children[2].children[2].innerText.match(/\d\d\/\d\d/)[0]
      }
    }))
  }
  return data
}

cron.schedule(config.get('cron'), sync, {
  scheduled: true,
  timezone: "Asia/Tokyo"
})

// 認証生成・既に存在する場合は更新
async function authorize() {
  if (fs.pathExistsSync('token.json')) {
    const oAuth2Client = await refreshOAuth2Client()
    console.log('Tokenがリフレッシュされました')
    return oAuth2Client
  } else {
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/tasks'],
    })
    console.log('URLをブラウザで開いて認証してください:', authUrl)

    const res = await prompt({
      type: 'input',
      name: 'code',
      message: 'コードを入力してください'
    })

    const token = await oAuth2Client.getToken(res.code)
    oAuth2Client.setCredentials(token.tokens)
    fs.writeFileSync('token.json', JSON.stringify(token.tokens))

    return oAuth2Client
  }
}

async function refreshOAuth2Client() {
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])

  oAuth2Client.setCredentials(JSON.parse(fs.readFileSync('token.json')))
  const token = await oAuth2Client.refreshAccessToken()
  oAuth2Client.setCredentials(token.credentials)

  await fs.writeFile('token.json', JSON.stringify(token.credentials))
  return oAuth2Client
}
