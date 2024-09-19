//////////////////////// 세팅 ////////////////////////
// express 라이브러리 사용
const express = require('express')
const app = express()

// css 파일 등록
app.use(express.static(__dirname + '/public'))

// MongoDB 연결
const {MongoClient} = require('mongodb');
let db;
// deployment
const url = process.env.DB_URL;
new MongoClient(url).connect().then((client)=>{
    console.log('DB연결성공')
    // database
    db = client.db('community')
    // 보통 DB 연결 후 8080포트에서 서버 실행
    app.listen(8080, () => {
        console.log('listening on port 8080')
    })

  }).catch((err)=>{
    console.log(err)
  })

// ejs - html에 데이터 삽입 가능
app.set('view engine', 'ejs');

//////////////////////// 서버 ////////////////////////
// 메인 페이지 접속 시 실행
app.get('/', (req, res) => {
    res.send('안녕')
})

app.get('/news', (req, res) => {
    // collection
    db.collection('write').insertOne({title: '망망이'})
    res.sendFile(__dirname + '/index.html')
})

app.get('/list', async (req, res) => {
    let result = await db.collection('write').find().toArray();
    // ejs파일은 render, views는 __dirname (views) 안 적어도 O
    // 데이터 전송은 파일 경로 뒤 {}
    res.render('list.ejs', {list: result})
})

app.get('/time', async (req, res) => {
    let time = new Date();
    res.render('time.ejs', {time})
})