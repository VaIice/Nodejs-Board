//////////////////////// 세팅 ////////////////////////
// express 라이브러리 사용
const express = require('express')
const app = express()

// css 파일 등록
app.use(express.static(__dirname + '/public'))

// MongoDB 연결
const { MongoClient } = require('mongodb');
// env 도와주는 라이브러리
require('dotenv').config();
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

// MongoDB Id 사용
const { ObjectId } = require('mongodb') 

// ejs - html에 데이터 삽입 가능
app.set('view engine', 'ejs');

// 클라이언트가 데이터 보내면 .body로 꺼내기 가능
app.use(express.json())
app.use(express.urlencoded({ extended: true })) 

// form에서의 PUT, DELETE method
const methodOverride = require('method-override')
app.use(methodOverride('_method')) 

const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')
const MongoStore = require('connect-mongo')
    
// passport 회원인증
// passport-local 아이디/비밀번호 방식 회원인증
// express-session 세션 라이브러리
app.use(passport.initialize())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave : false,
    saveUninitialized: false,
    // 유효기간
    cookie: { maxAge: 60 * 60 * 1000 },
    store: MongoStore.create({
        mongoUrl: process.env.DB_URL,
        dbName: 'community'
    })
}))

app.use(passport.session()) 

// 입력한 정보가 DB와 일치하는지 검증
// username / password
passport.use(new LocalStrategy(async (id, password, cb) => {
  let result = await db.collection('user').findOne({ id: id })
  if (!result) {
    return cb(null, false, { message: '존재하지 않는 ID입니다.' })
    }
  if (await bcrypt.compare(password, result.password)) {
    return cb(null, result)
  } else {
    return cb(null, false, { message: '비밀번호가 불일치합니다.' });
  }
}))

// 로그인 성공 시 세션 발행 / req.login()시 동작
passport.serializeUser((user, done) => {
    process.nextTick(() => {
        done(null, { _id: user._id })
    })
})

// 쿠키 분석 / 쿠키 이상 없을 시 유저 정보 알려줌
// 로그인 성공 시 user (사용자 정보) 반환
// 아무데서나 req.user을 출력 시 유저 정보 출력 가능
passport.deserializeUser(async (user, done) => {
    let result = await db.collection('user').findOne({ _id: new ObjectId(user._id) })
    delete result.password;
    // req.user에 저장
    process.nextTick(() => {
        done(null, result)
    })
})

const bcrypt = require('bcrypt')

//////////////////////// 서버 ////////////////////////
app.get('/', (req, res) => {
    res.redirect('/list/1')
})

app.get('/news', (req, res) => {
    // collection
    db.collection('write').insertOne({title: '멍멍이'})
    res.sendFile(__dirname + '/index.html')
})

app.get('/list/:page', async (req, res) => {
    // skip 느림, _id로 찾는 게 제일 빠름
    let result = await db.collection('write').find().skip((req.params.page - 1) * 5).limit(5).toArray();
    const totalCount = await db.collection('write').countDocuments();
    const totalPage =  Math.ceil(totalCount / 5);
    // ejs파일은 render, views는 __dirname (views) 안 적어도 O
    // 데이터 전송은 파일 경로 뒤 {}
    res.render('list.ejs', {list: result, totalPage})
})

app.get('/list/next/:id', async (req, res) => {
    // skip 느림, _id로 찾는 게 제일 빠름
    let result = await db.collection('write').find({ _id: { $gt: new ObjectId(req.params.id) } }).limit(5).toArray();
    const totalCount = await db.collection('write').countDocuments();
    const totalPage =  Math.ceil(totalCount / 5);    
    // ejs파일은 render, views는 __dirname (views) 안 적어도 O
    // 데이터 전송은 파일 경로 뒤 {}
    res.render('list.ejs', {list: result, totalPage})
})

app.get('/write', (req, res) => {
    if (req.user) {
        res.render('write.ejs');
        return;
    }
    res.send('로그인 하세요')
})

app.post('/write/add', async (req, res) => {
    try {
        const body = req.body;
        const data = {
            title: body.title,
            content: body.content
        }
        if (!data.title || !data.content) {
            res.send('내용을 입력해주세요.');
        }
        // collection에 document 기록
        else if (res.statusCode === 200) {
            let result = await db.collection('write').insertOne(data)
            res.redirect('/list')
        }
        else {
            res.redirect('/')
        }
    }
    catch {
        res.redirect('/')
    }
})

app.get('/detail/:id', async (req, res) => {
    // :param -> req.params.param
    let result = await db.collection('write').findOne({ _id: new ObjectId(req.params.id) }) 

    const data = {
        id: result._id,
        title: result.title,
        content: result.content
    }
    res.render('detail.ejs', data);
})

app.delete('/delete', async (req, res) => {
    try {
        if (!req.query.id || !ObjectId.isValid(req.query.id)) {
            return res.status(400).send('유효하지 않은 ID입니다.');
        }

        const document = await db.collection('write').findOne({ _id: new ObjectId(req.query.id) });
        if (!document) {
            return res.status(404).send('삭제할 항목을 찾을 수 없습니다.');
        }

        let result = await db.collection('write').deleteOne({ _id: new ObjectId(req.query.id) });
        if (result.deletedCount === 1) {
            return res.status(204).send();
        }
    } catch (error) {
        console.log(error);
        res.status(500).send('서버 오류');
    }
});

app.get('/modify/:id', async (req, res) => {
    // :param -> req.params.param
    let result = await db.collection('write').findOne({ _id: new ObjectId(req.params.id) }) 
    const data = {
        id: result._id,
        title: result.title,
        content: result.content
    }
    res.render('modify.ejs', data);
})

app.put('/modify/:id', async (req, res) => {
    // :param -> req.params.param
    const body = req.body;
    let data = {
        // $inc 증감 연산자
        // $mul 곱셈
        // $unset 삭제
        $set: {
            title: body.title,
            content: body.content
        }
    }
    // $gt 초과
    // $gte 이상
    // $lt 미만
    // $lte 이하
    // $ne !==
    // let result = await db.collection('write').updateMany({ like: {$gt: 5}, data) 
    let result = await db.collection('write').updateOne({ _id: new ObjectId(req.params.id) }, data) 
    res.redirect('/list')
})

app.get('/sign-up', async (req, res) => {
    res.render('signUp.ejs');
})

app.post('/sign-up/add', async (req, res) => {
    const body = req.body;
    if (body.id && body.password) {
        let hashingPassword = await bcrypt.hash(body.password, 10);
        const data = {
            id: body.id,
            password: hashingPassword
        }
        let isOverwrite = await db.collection('user').findOne({ id: data.id });
        if (isOverwrite) {
            res.send('새로운 아이디를 입력해주세요.');
            return;
        }
        let result = await db.collection('user').insertOne(data);
        if (result.insertedId) {
            res.redirect('/');
        } else {
            res.status(500).send('서버 에러');
        }
    }
    else {
        res.status(400).send('내용을 입력해주세요');
    }
})

app.get('/sign-in', async (req, res) => {
    res.render('signIn.ejs');
})

app.post('/sign-in', async (req, res, next) => {
    // local strategy / 로그인 요청 처리
    // 기본적으로 username과 password 필드를 찾고 req.body이 전달
    if (req.body.password !== req.body.passwordCheck) {
        res.send('비밀번호가 다르잖아요')
        return;
    }
    passport.authenticate('local', (error, user, info) => {
        if (error) return res.status(500).json(error)
        if (!user) return res.status(401).json(info.message)
        // 로그인 처리 중 / user가 존재할 경우 세션에 사용자 정보 저장
        req.logIn(user, (err) => {
            if (err) return next(err)
            res.redirect('/')
        })
    })(req, res, next)
})

app.get('/me', async (req, res) => {
    if (req.user) {
        res.render('me.ejs', {id: req.user.id});
    }
    else {
        res.send('마이페이지를 접속할 수 없습니다.')
    }
})

app.get('/sign-out', (req, res) => {
    if (req.user) {
        req.session.destroy((err) => {
            if (err) return next(err)
            res.clearCookie('connect.sid');             
            res.redirect('/')
        })
        return;
    }
    res.send('로그인 하세요')
})