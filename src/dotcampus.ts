import moment from 'moment';
import { Request } from "./request";

const URL = {
  LOGIN: "/Secure/Login.aspx?ReturnUrl=%2Fcampus%2FPortal%2FHome",
  HOME: "/Portal/Home",
  PROFILE: "/Community/Profile",
  SCHEDULE: "/Portal/FullSchedule/FetchEvents",
  NOTIFICATION: "/Mvc/Notification/GetNotifications",
  ANNOUNCEMENT: "/Portal/TryAnnouncement/GetAnnouncement",
  ANNOUNCEMENTS: "/Portal/TryAnnouncement/GetAnnouncements",
  TASK: "/Mvc/Manavi/GetTask"
}

export default class DotCampus {
  id: string;
  pw: string;
  req: Request;

  constructor(baseURL: string, id: string, pw: string) {
    this.id = id;
    this.pw = pw;
    this.req = new Request(baseURL);
  }

  async checkLogin() {
    if (!(await this.isLoggedIn())) await this.login();
  }

  async login() {
    const body = (await this.req.get(URL.LOGIN)).body()
    const data = {
      __VIEWSTATE: body.getAttr("#__VIEWSTATE", 'value'),
      __VIEWSTATEGENERATOR: body.getAttr("#__VIEWSTATEGENERATOR", 'value'),
      __EVENTVALIDATION: body.getAttr("#__EVENTVALIDATION", 'value'),
      buttonHtmlLogon: body.getAttr("#buttonHtmlLogon", 'value'),
      TextLoginID: this.id,
      TextPassword: this.pw,
    };

    return await this.req.post(URL.LOGIN, data);
  }

  async isLoggedIn() {
    const result = await this.req.get(URL.HOME, {
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    })
    return result.status() == 200;
  }

  async getUUID() {
    const body = (await this.req.get(URL.PROFILE)).body()
    const url = body.getAttr("#profile-img-photo", 'src').split("/");
    return url[url.length - 1];
  }

  // 自分の予定（カレンダー）
  async getFullEvent(start: number) {
    return (await this.req.get(URL.SCHEDULE, { params: { id: "", _: new Date().getTime() }}))
      .data()
      .filter((e :any) => e.start >= start);
  }

  // 学校からのお知らせ
  async getAnnouncements() {
    const now = new Date();
    return (await this.req.get(URL.ANNOUNCEMENTS, { params: {
      categoryId: 0,
      passdaysId: 0,
      isCustomSearch: false,
      customSearchCategoryId: 0,
      keyword: "",
      startIsoDate: moment(now).month(now.getMonth() - 3).hour(24).minute(0).seconds(0).milliseconds(909).utc().toISOString(),
      endIsoDate: moment(now).hour(23).minute(59).seconds(59).milliseconds(909).utc().toISOString()
    }})).data().data
  }

  async getAnnouncementDetail(aId: string) {
    return (await this.req.get(URL.ANNOUNCEMENT, { params: { aId, _: new Date().getTime() } })).data().Body
  }

  // 自分宛ての通知
  async getNotifications() {
    return (await this.req.get(URL.NOTIFICATION)).data().data;
  }

  async getTaskDetail(groupId: string, tId: string) {
    const body = (await this.req.get(`/Course/${groupId}/21/`)).body();
    const gToken = body.getAttr("[name=__GroupAccessToken]", 'value');
    return (await this.req.get(URL.TASK, {params: {tId, gToken, p: new Date().getTime()}})).data().Description;
  }
}
