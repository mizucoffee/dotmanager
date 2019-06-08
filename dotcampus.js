const puppeteer = require('puppeteer')
const path = require('path')
const url = require('url')
const moment = require('moment')

class dotCampus {
    constructor(page, url, id, pw) {
        if (typeof page === 'undefined') {
            throw new Error('await dotCampus.build()を使用してください。')
        }
        this.page = page
        this.url = url
        this.id = id
        this.pw = pw
    }

    static build(url, id, pw) {
        return puppeteer.launch({
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            })
            .then(browser => browser.newPage())
            .then(page => new dotCampus(page, url, id, pw))
    }

    async checkLogin() {
        if (!await this.isLoggedIn(this.page)) await this.login(this.page)
    }

    async login() {
        await this.page.type('#TextLoginID', this.id)
        await this.page.type('#TextPassword', this.pw)
        await this.page.click('#buttonHtmlLogon')
        console.log('ログインしました')
    }

    async isLoggedIn() {
        await this.page.goto(path.join(this.url, '/'))

        return await this.page.evaluate(() => {
            const node = document.querySelectorAll("#buttonHtmlLogon")
            return node.length ? false : true
        })
    }

    async screenshot() {
        await this.page.screenshot({
            path: `${new Date().getTime()}.png`
        })
    }

    async getUUID() {
        await this.page.goto(url.resolve(this.url, 'Community/Profile'))
        return await this.page.evaluate(() => {
            const photo = document.querySelector('#profile-img-photo')
            return photo.src.split('/')[photo.src.split('/').length - 1]
        })
    }

    async getFullEvent(start) {
        await this.page.goto(path.join(this.url, '/Portal/FullSchedule/FetchEvents?id=&_=' + new Date().getTime()))
        let events = JSON.parse(await this.page.evaluate(() => document.querySelector('body').innerText))
        return events.filter(e => e.start >= start)
    }

    async getAnnouncements() {
        const now = new Date()
        await this.page.goto(path.join(this.url, '/Portal/TryAnnouncement/GetAnnouncements?' +
            'categoryId=0&' +
            'passdaysId=0&' +
            'isCustomSearch=false' +
            '&customSearchCategoryId=0' +
            '&keyword=' +
            `&startIsoDate=${moment(now).month(now.getMonth()-3).hour(24).minute(0).seconds(0).milliseconds(909).utc().toISOString()}` +
            `&endIsoDate=${moment(now).hour(23).minute(59).seconds(59).milliseconds(909).utc().toISOString()}`))
        return JSON.parse(await this.page.evaluate(() => document.querySelector('body').innerText))
    }

    async getAnnouncementDetail(id) {
        await this.page.goto(path.join(this.url, '/Portal/TryAnnouncement/GetAnnouncement?aId=' + id + '&_=' + new Date().getTime()))
        return JSON.parse(await this.page.evaluate(() => document.querySelector('body').innerText))
    }

    async close() {
        this.page.browser().close()
    }
}

module.exports = dotCampus