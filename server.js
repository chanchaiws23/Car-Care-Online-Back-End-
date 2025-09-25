require("dotenv").config();
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const bodyParser = require("body-parser");
const { passport } = require("./config/passport-config");
const authRoutes = require("./routes/auth");
const employeeRoutes = require("./routes/employee");
const infomationRoutes = require("./routes/infomation");
const packageRoutes = require("./routes/package");
const promotionRoutes = require("./routes/promotion");
const reservationRoutes = require("./routes/reservation");
const serviceRoutes = require("./routes/service");
const toolsRoutes = require("./routes/tools");
const userRoutes = require("./routes/user");
const dashboardRoutes = require("./routes/dashboard");
const paymentRoutes = require("./routes/payment");
const incomeRoutes = require("./routes/income");
const expenseRoutes = require("./routes/expense");
const useserRoutes = require("./routes/useser");
const scoreRoutes = require("./routes/score");
const notificationRoutes = require("./routes/notification");
const workTableRoutes = require("./routes/work-table");
const reviewRoutes = require("./routes/review");

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.API_FRONT_URL,
  credentials: true
}));

// Session configuration
app.use(session({
  secret: process.env.ACCESS_TOKEN_SECRET ,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set to true if using https
    httpOnly: false, // allow JavaScript access
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

app.get('/auth/google/callback', passport.authenticate('google', {
  failureRedirect: process.env.API_FRONT_URL + '/login-fail'
}), (req, res) => {
  console.log('=== GOOGLE OAUTH CALLBACK HANDLER ===');
  console.log('User object:', req.user);
  console.log('Session:', req.session);
  console.log('Is authenticated:', req.isAuthenticated());
  console.log('Session ID:', req.sessionID);
  console.log('Cookies:', req.headers.cookie);

  // ใช้ URL parameters แทน session
  if (req.isAuthenticated() && req.user) {
    console.log('User is authenticated, sending user data via URL');
    const userData = encodeURIComponent(JSON.stringify(req.user));
    console.log('Encoded user data:', userData);
    res.redirect(`${process.env.API_FRONT_URL}/dashboard?user=${userData}`);
  } else {
    console.log('User is not authenticated, redirecting to login');
    res.redirect(`${process.env.API_FRONT_URL}/login`);
  }
});

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));

app.get('/auth/facebook/callback', passport.authenticate('facebook', {
  failureRedirect: `${process.env.API_FRONT_URL}/login-fail`
}), (req, res) => {
  console.log('=== FACEBOOK OAUTH CALLBACK HANDLER ===');
  console.log('User object:', req.user);
  console.log('Session:', req.session);
  console.log('Is authenticated:', req.isAuthenticated());

  if (req.isAuthenticated()) {
    console.log('User is authenticated, redirecting to dashboard');
    const userData = encodeURIComponent(JSON.stringify(req.user));
    res.redirect(`${process.env.API_FRONT_URL}/dashboard?user=${userData}`);
  } else {
    console.log('User is not authenticated, redirecting to login');
    res.redirect(`${process.env.API_FRONT_URL}/login`);
  }
});

// Success route for OAuth (fallback)
app.get('/success', (req, res) => {
  res.redirect(`${process.env.API_FRONT_URL}/login-success`);
});

// Fail route for OAuth (fallback)
app.get('/fail', (req, res) => {
  res.redirect(`${process.env.API_FRONT_URL}/login-fail`);
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/register", authRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/infomation", infomationRoutes);
app.use("/api/package", packageRoutes);
app.use("/api/promotion", promotionRoutes);
app.use("/api/reservation", reservationRoutes);
app.use("/api/service", serviceRoutes);
app.use("/api/tools", toolsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/income", incomeRoutes);
app.use("/api/expense", expenseRoutes);
app.use("/api/useser", useserRoutes);
app.use("/api/score", scoreRoutes);
app.use("/api/notification", notificationRoutes);
app.use("/api/work-table", workTableRoutes);
app.use("/review", reviewRoutes);


// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
