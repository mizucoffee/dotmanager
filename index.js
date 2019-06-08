const config = require('config')
const google = require('googleapis').google
const fs = require('fs-extra')
const prompt = require('enquirer').prompt
const cron = require('node-cron')
const moment = require('moment-timezone')
const request = require('request')
const Store = require('data-store')
const h2p = require('html2plaintext')
const path = require('path')
const store = new Store({
  path: 'data.json'
})
const dotCampus = require('./dotcampus')

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

main()

async function main() {
  const dot = await dotCampus.build(config.get('dotcampus.url'), config.get('dotcampus.id'), config.get('dotcampus.password'))
  await dot.checkLogin()
  store.set('uuid', await dot.getUUID())

  console.log('uuid:', store.get('uuid'))

  const ca = new Set(store.get('announcements'))
  const announcements = (await dot.getAnnouncements()).data
  announcements.forEach(a => ca.add(a.Id))
  store.set('announcements',Array.from(ca))

  dot.close()

  await authorize()
  await sync()
}

async function sync() {
  const dot = await dotCampus.build(config.get('dotcampus.url'), config.get('dotcampus.id'), config.get('dotcampus.password'))
  await dot.checkLogin()

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

  const current = store.get('events') || []
  const events = (await dot.getFullEvent(Math.round(moment(new Date()).add(-30,'day').valueOf()/1000)))
    .filter(e => !current.includes(e.id))

  for (let e of events) {
    due = moment(e.end * 1000)
    if (config.get('ifttt.reminder') != "") {
      request.post(config.get('ifttt.reminder')).form({
        value1: `${e.title} - ${e.groupname}`,
        value2: `${due.format('MM')}/${due.format('DD')}/${due.format('YYYY')} at 11:59pm`
      })
    }
    await tasks.tasks.insert({
      tasklist: tasklistId,
      resource: {
        title: e.title,
        notes: h2p(e.description),
        due: `${due.format('YYYY')}-${due.format('MM')}-${due.format('DD')}T00:00:00.000000Z`
      }
    })
    current.push(e.id)
  }

  store.set('events', current)

  if (events.length > 0 && config.get('ifttt.notification') != "")
    postIFTTT('notification', 'dotCampus - スケジュール更新', 'スケジュールが更新されました。\n詳しくはTasksアプリで確認してください。')

  const currentAnnouncements = store.get('announcements') || []
  const announcements = (await dot.getAnnouncements()).data.filter(a => !currentAnnouncements.includes(a.Id))
  for (let a of announcements) {
    const detail = await dot.getAnnouncementDetail(a.Id)
    postIFTTT('announcements', 'dotCampus - ' + a.Title, detail.Body, path.join(config.get('dotcampus.url'), '/Portal/TryAnnouncement#/detail/' + a.Id))
    currentAnnouncements.push(a.Id)
  }
  
  console.log('同期処理を実行しました:', moment(new Date()).tz("Asia/Tokyo").format())
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

function postIFTTT(type, value1, value2, value3) {
  request.post(config.get(`ifttt.${type}`)).form({
    value1,
    value2: value2.replace(/(<br>|<br \/>)/gi, '\n').slice(0, 200),
    value3
  })
}