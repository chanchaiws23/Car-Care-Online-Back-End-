require('dotenv').config();
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const mysql = require('mysql2');
const bcrypt = require('bcrypt');

// เชื่อมต่อ MySQL โดยใช้ค่าจาก .env
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Google OAuth Strategy (ใช้ dummy values ชั่วคราว)
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || `${process.env.API_BACK_URL}/auth/google/callback`
}, (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;
  console.log('Google OAuth - Checking email:', email);

  connection.query('SELECT * FROM User WHERE User_email = ?', [email], (err, results) => {
    if (err) {
      console.error('Database error in Google OAuth:', err);
      return done(err);
    }

    if (results.length > 0) {
      // User มีอยู่แล้ว - ให้ login สำเร็จ
      const existingUser = results[0];
      console.log('Google OAuth - User found in database:', existingUser.User_name);
      return done(null, existingUser);
    } else {
      // ถ้ายังไม่มีผู้ใช้ให้เพิ่มเข้าไป
      const newUser = {
        User_name: profile.displayName,
        User_email: email,
        User_tel: '',
        User_address: '',
        User_password: ''
      };
      console.log('Google OAuth - Creating new user:', newUser);
      connection.query('INSERT INTO User SET ?', newUser, (err, result) => {
        if (err) {
          console.error('Error creating new user:', err);
          return done(err);
        }
        newUser.User_id = result.insertId;
        console.log('Google OAuth - New user created with ID:', newUser.User_id);
        return done(null, newUser);
      });
    }
  });
}));

passport.use(new LocalStrategy({
  usernameField: 'email',   // ฟิลด์ชื่ออีเมล
  passwordField: 'password' // ฟิลด์รหัสผ่าน
}, async (email, password, done) => {
  try {
    connection.query('SELECT * FROM User WHERE User_email = ?', [email], (err, results) => {
      if (err) return done(err);

      if (!results || results.length === 0) {
        return done(null, false, { message: 'Incorrect username or password.' });
      }

      const user = results[0];
      bcrypt.compare(password, user.User_password, (err, match) => {
        if (err) return done(err);

        if (!match) {
          return done(null, false, { message: 'Incorrect username or password.' });
        }

        return done(null, user);  // ส่งข้อมูลผู้ใช้กลับ
      });
    });
  } catch (error) {
    return done(error);
  }
}));

// Facebook OAuth Strategy
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: `${process.env.API_BACK_URL || 'http://localhost:3000'}/auth/facebook/callback`,
  profileFields: ['id', 'displayName', 'emails']
}, (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;
  console.log('Facebook OAuth - Checking email:', email);

  connection.query('SELECT * FROM User WHERE User_email = ?', [email], (err, results) => {
    if (err) {
      console.error('Database error in Facebook OAuth:', err);
      return done(err);
    }

    if (results.length > 0) {
      // User มีอยู่แล้ว - ตรวจสอบข้อมูลครบถ้วนหรือไม่
      const existingUser = results[0];
      console.log('Facebook OAuth - User found in database:', existingUser.User_name);

      // ตรวจสอบว่าข้อมูลครบถ้วนหรือไม่
      if (!existingUser.User_name || !existingUser.User_tel || !existingUser.User_address) {
        existingUser.needsProfileUpdate = true;
        console.log('Facebook OAuth - User needs profile update');
      }

      return done(null, existingUser);
    } else {
      // ถ้ายังไม่มีผู้ใช้ให้เพิ่มเข้าไป
      const newUser = {
        User_name: profile.displayName,
        User_email: email,
        User_tel: '',
        User_address: '',
        User_password: '',
        needsProfileUpdate: true
      };
      console.log('Facebook OAuth - Creating new user:', newUser);
      connection.query('INSERT INTO User SET ?', newUser, (err, result) => {
        if (err) {
          console.error('Error creating new user:', err);
          return done(err);
        }
        newUser.User_id = result.insertId;
        console.log('Facebook OAuth - New user created with ID:', newUser.User_id);
        return done(null, newUser);
      });
    }
  });
}));

// ฟังก์ชันในการจัดการ session ของผู้ใช้
passport.serializeUser((user, done) => {
  done(null, user.User_id);  // เก็บแค่ user.User_id ใน session
});

passport.deserializeUser((id, done) => {
  connection.query('SELECT * FROM User WHERE User_id = ?', [id], (err, results) => {
    if (err) return done(err);
    done(null, results[0]);
  });
});

module.exports = { passport, connection };
