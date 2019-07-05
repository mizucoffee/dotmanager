const express = require('express')
const ip = require('ip')
const ora = require('ora')
const bodyParser = require('body-parser')
const auth = require('basic-auth')
const fs = require('fs')
const Store = require('data-store')
const app = express()
const port = 10100

if (fs.existsSync('config.json')) {
    console.log('既に設定ファイルが生成されています。')
    console.log('再設定したい場合は、config.jsonを削除してからもう一度init.jsを実行してください。')
    return
}

const id = Math.random().toString(36).slice(-8)
let spinner

app.use(bodyParser.urlencoded({
    extended: false
}))
app.set('view engine', 'pug')
app.use(express.static('public'))

const server = app.listen(port, () => {
    console.log('------------------------------------------')
    console.log()
    console.log(' 設定用ページを起動しました。')
    console.log(' 手順に従って設定を進めてください。')
    console.log()
    console.log('------------------------------------------')
    console.log()
    console.log(` http://${ip.address()}:${port}/`)
    console.log()
    console.log(` UserName: dotmanager`)
    console.log(` Password: ${id}`)
    console.log()
    spinner = ora('設定待機中').start()
})

app.get('/', (req, res) => {
    const user = auth(req)
    if (!user || user.name != 'dotmanager' || user.pass != id) {
        res.set('WWW-Authenticate', 'Basic realm="main"')
        return res.status(401).send()
    }
    res.render('index')
})

app.post('/', (req, res) => {
    const config = new Store({
        path: 'config.json'
    })
    config.set('url', req.body.url)
    config.set('id', req.body.id)
    config.set('pw', req.body.pw)
    config.set('ifttt', req.body.ifttt)
    config.set('cron', '0 7,19 * * *')
    spinner.succeed('設定完了')
    res.render('success')
    console.log()
    console.log('$ node index.js')
    console.log('を実行してください。')
    return server.close()
})