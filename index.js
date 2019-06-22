const fs = require('fs-extra')
const cron = require('node-cron')
const moment = require('moment-timezone')
const axios = require('axios')
const Store = require('data-store')
const h2p = require('html2plaintext')
const querystring = require('querystring')
const urljoin = require('url-join')
const store = new Store({
  path: 'data.json'
})
const config = new Store({
  path: 'config.json'
})
const dotCampus = require('./dotcampus')
const minute = Math.floor(Math.random() * 60)

if (!fs.existsSync('config.json')) {
  console.log('設定ファイルが存在しません。')
  console.log('init.jsを実行してください。')
  return
}

main()

async function main() {
  const dot = new dotCampus(config.get('url'), config.get('id'), config.get('pw'))
  await dot.checkLogin()

  store.set('uuid', await dot.getUUID())
  console.log('uuid:', store.get('uuid'))

  const ca = new Set(store.get('notifications'))
  const notifications = (await dot.getNotifications())
  notifications.forEach(a => ca.add(a.Id))
  store.set('notifications', Array.from(ca))

  postIFTTT('dm_notification', 'dotManager - 起動通知', '正常に起動しました。この通知は無視してください。')

  await sync()
}

async function sync() {
  const dot = new dotCampus(config.get('url'), config.get('id'), config.get('pw'))
  await dot.checkLogin()

  const current = store.get('events') || []
  const events = (await dot.getFullEvent(Math.round(moment(new Date()).add(-30, 'day').valueOf() / 1000)))
    .filter(e => !current.includes(e.id))

  for (let e of events) {
    due = moment(e.end * 1000)
    postIFTTT('dm_reminder',
      `${e.title} - ${e.groupname}`,
      `${due.format('MM')}/${due.format('DD')}/${due.format('YYYY')} at 11:59pm`,
      h2p(e.description))
    current.push(e.id)
  }

  store.set('events', current)

  if (events.length > 0)
    postIFTTT('dm_notification', 'dotCampus - スケジュール更新', 'スケジュールが更新されました。\n詳しくはTasksアプリで確認してください。')

  const currentAnnouncements = store.get('notifications') || []
  const announcements = (await dot.getNotifications()).filter(a => !currentAnnouncements.includes(a.Id))
  for (let a of announcements) {
    let detail = (await dot.getAnnouncementDetail(a.ItemId)).Body
    let url

    switch (a.NoticeType) {
      case 1:
      case 36:
        url = urljoin(config.get('url'), `/Course/${a.FromGroupId}/65/#/detail/${a.ItemId}`)
        break
      case 2:
        url = urljoin(config.get('url'), `/Portal/TryAnnouncement#/detail/${a.ItemId}`)
        break
      default:
        url = ''
        break
    }
    postIFTTT('dm_notification', 'dotCampus - ' + a.Title, detail, url)
    currentAnnouncements.push(a.Id)

    store.set('notifications', currentAnnouncements)
  }

  console.log('同期処理を実行しました:', moment(new Date()).tz("Asia/Tokyo").format())
}

cron.schedule(`${minute} ${config.get('cron')} * * *`, sync, {
  scheduled: true,
  timezone: "Asia/Tokyo"
})

function postIFTTT(event, value1, value2 = "", value3) {
  axios.post(`https://maker.ifttt.com/trigger/${event}/with/key/${config.get(`ifttt`)}`, querystring.stringify({
    value1,
    value2: value2.replace(/(<br>|<br \/>)/gi, '\n').slice(0, 200),
    value3
  }))
}