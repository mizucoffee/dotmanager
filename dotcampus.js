const moment = require('moment')
const axios = require('axios')
const parse = require('node-html-parser').parse
const querystring = require('querystring')
const axiosCookieJarSupport = require('axios-cookiejar-support').default
const tough = require('tough-cookie')

const dotcampus = axios.create({
    jar: new tough.CookieJar(),
    withCredentials: true
})

axiosCookieJarSupport(dotcampus)
dotcampus.defaults.jar = new tough.CookieJar()

class dotCampus {
    constructor(url, id, pw) {
        this.id = id
        this.pw = pw
        dotcampus.defaults.baseURL = url
    }

    async checkLogin() {
        if (!await this.isLoggedIn(this.page)) await this.login(this.page)
    }

    async login() {
        const body = parse((await dotcampus.get('/Secure/Login.aspx?ReturnUrl=%2Fcampus%2FPortal%2FHome')).data)
        const data = {
            __VIEWSTATE: body.querySelector('#__VIEWSTATE').attributes.value,
            __VIEWSTATEGENERATOR: body.querySelector('#__VIEWSTATEGENERATOR').attributes.value,
            __EVENTVALIDATION: body.querySelector('#__EVENTVALIDATION').attributes.value,
            buttonHtmlLogon: body.querySelector('#buttonHtmlLogon').attributes.value,
            TextLoginID: this.id,
            TextPassword: this.pw
        }

        await dotcampus.post('/Secure/Login.aspx?ReturnUrl=%2fcampus%2fPortal%2fHome', querystring.stringify(data))
        console.log('ログインしました')
    }

    async isLoggedIn() {
        return (await dotcampus.get('/Portal/Home', {
            maxRedirects: 0,
            validateStatus: status => status >= 200 && status < 400
        })).status == 200
    }

    async getUUID() {
        const body = parse((await dotcampus.get('/Community/Profile')).data)
        const url = body.querySelector('#profile-img-photo').attributes.src.split('/')
        return url[url.length - 1]
    }

    // 自分の予定（カレンダー）
    async getFullEvent(start) {
        let events = (await dotcampus.get('/Portal/FullSchedule/FetchEvents?id=&_=' + new Date().getTime())).data
        return events.filter(e => e.start >= start)
    }

    // 学校からのお知らせ
    async getAnnouncements() {
        const now = new Date()
        return (await dotcampus.get('/Portal/TryAnnouncement/GetAnnouncements?' +
            'categoryId=0&' +
            'passdaysId=0&' +
            'isCustomSearch=false' +
            '&customSearchCategoryId=0' +
            '&keyword=' +
            `&startIsoDate=${moment(now).month(now.getMonth()-3).hour(24).minute(0).seconds(0).milliseconds(909).utc().toISOString()}` +
            `&endIsoDate=${moment(now).hour(23).minute(59).seconds(59).milliseconds(909).utc().toISOString()}`)).data.data
    }

    async getAnnouncementDetail(id) {
        return (await dotcampus.get('/Portal/TryAnnouncement/GetAnnouncement?aId=' + id + '&_=' + new Date().getTime())).data
    }

    // 自分宛ての通知
    async getNotifications() {
        return (await dotcampus.get('/Mvc/Notification/GetNotifications')).data.data
    }

    async getTaskDetail(groupId,itemId) {
        const body = parse((await dotcampus.get(`/Course/${groupId}/21/`)).data)
        const token = body.querySelector("[name=__GroupAccessToken]").attributes.value
        return (await dotcampus.get(`/Mvc/Manavi/GetTask?tId=${itemId}&p=${new Date().getTime()}&gToken=${encodeURIComponent(token)}`)).data
    }

}

module.exports = dotCampus