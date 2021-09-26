import axios from "axios";
import DotCampus from "./dotcampus";
import urljoin from "url-join";
import moment from 'moment-timezone';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client'

dotenv.config()
const prisma = new PrismaClient()

const url = `${process.env.DC_URL}`
const id = `${process.env.DC_ID}`
const pw = `${process.env.DC_PASSWORD}`

async function main() {
  postIFTTT("dm_notification", "dotManager - 起動通知", "正常に起動しました。この通知は無視してください。");
  await sync();
}

main();

async function sync() {
  const dc = new DotCampus(url, id, pw);
  await dc.checkLogin();

  const events = await dc.getFullEvent(Math.round(moment(new Date()).add(-30, "day").valueOf() / 1000))

  for (let e of events) {
    if((await prisma.event.findFirst({where: {eventId: e.id}})) != null) continue
    const due = moment(e.end * 1000);
    postIFTTT(
      "dm_reminder",
      `${e.title} - ${e.groupname}`,
      `${due.format("MM")}/${due.format("DD")}/${due.format("YYYY")}`,
      e.description
    );
    await prisma.event.create({ data: { eventId: parseInt(e.id) } })
  }

  if (events.length > 0)
    postIFTTT(
      "dm_notification",
      "dotCampus - スケジュール更新",
      "スケジュールが更新されました。\n詳細はリマインダーアプリで確認してください。"
    );

  const announcements = await dc.getNotifications()
  for (let a of announcements) {
    if((await prisma.notification.findFirst({where: {notificationId: a.id}})) != null) continue
    let title, detail, postUrl;

    switch (a.NoticeType) {
      case 1:
        title = `dotCampus - ${a.Title}`;
        detail = await dc.getAnnouncementDetail(a.ItemId);
        postUrl = urljoin(url, `/Course/${a.FromGroupId}/65/#/detail/${a.ItemId}`);
        break;
      case 2:
        title = "dotCampus - " + a.Title;
        detail = await dc.getAnnouncementDetail(a.ItemId);
        postUrl = urljoin(url, `/Portal/TryAnnouncement#/detail/${a.ItemId}`);
        break;
      case 36:
        title = `dotCampus - 教材更新通知 ${a.CourseName}`;
        detail = await dc.getTaskDetail(a.FromGroupId, a.ItemId) || "本文無し";
        postUrl = urljoin(url, `/Course/${a.FromGroupId}/21/#/detail/${a.TaskBlockId}/${a.ItemID}`);
        break;
      default:
        continue;
    }
    postIFTTT("dm_notification", title, detail, url);
    await prisma.notification.create({ data: { notificationId: a.Id } })
  }

  console.log(
    "同期処理を実行しました:",
    moment(new Date()).tz("Asia/Tokyo").format()
  );
}

cron.schedule(`${process.env.DC_CRON}`, sync, {
  scheduled: true,
  timezone: "Asia/Tokyo",
});

function postIFTTT(
  event: string,
  value1: string,
  value2 = "",
  value3?: string
) {
  const data = new URLSearchParams();
  data.append("value1", value1);
  data.append("value2", value2.replace(/<[^>]*>/g, "").slice(0, 200));
  if (value3) data.append("value3", value3.replace(/<[^>]*>/g, "").slice(0, 200));
  axios.post(
    `https://maker.ifttt.com/trigger/${event}/with/key/${process.env.DC_IFTTT}`,
    data
  );
}
