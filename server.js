const express = require("express");
const { check } = require('express-validator');
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

// Import dotenv file
require('dotenv').config()

const app = express();

app.use (bodyParser.json ());
app.use (bodyParser.urlencoded ({extended: true}));

app.use(session({
    secret: "Light House",
    resave: false,
    saveUninitialized: false
}));


app.use(passport.initialize());
app.use(passport.session());



mongoose.connect(process.env.MONGO_URI,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      console.log('Connected to database !!');
    })
    .catch((err)=>{
      console.log('Connection failed !!'+ err.message);
    });


const userSchema = new mongoose.Schema ({
    name: String,
    number: Number,
    church: String,
    location: String,
    email: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose, {usernameField: 'email'});
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user){
        done(err, user);
    });
  });


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:8080/auth/google/secrets",
    userProfileUrl: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


// The route to homepage
app.get ("/", function(req, res){
    res.send('Welcome To Light House Church');
});

// The route to signup/login using google
app.get ("/auth/google", 
    passport.authenticate('google', {scope: ["profile"] })
);

// The route to the page to input quiz code (the secret page) after authentication with google
app.get ("/auth/google/secrets", 
    passport.authenticate('google', {failureRedirect: "/login" }),
    function(req, res) {
        // successful authentication redirect to secrets
        res.redirect("/secrets");
    }
);

// The route to login page
app.get ("/login", function(req, res){
    res.send('Kindly Login here!');
});

// The route to signup page
app.get ("/signup", function(req, res){
    res.send("Kindly signup here")
});

// The route to dashboard
app.get ("/dashboard", function(req, res){
    if (req.isAuthenticated()){
     res.send('Welcome To Your Dashbaord');
    }else{
        res.redirect("/login")
    }
});

// The route to the page to enter quiz code
app.get("/secrets", function(req, res){
    if (req.isAuthenticated()){
        res.send("Enter Your  Quiz Code Here!")
    }else{
        res.redirect("/login")
    }
});

// The route to the quiz page
app.get("/quiz", function(req, res){
    if (req.isAuthenticated()){
        res.send("Here are Your Quiz Questions")
    }else{
        res.redirect("/secrets")
    }
});

// The route to display score 
app.get ("/score", function(req, res){
    if (req.isAuthenticated()){
        res.send("Your Score Is...")
    }else{
        res.redirect("/login")
    }
});

// The route to the summary page -attached to the view summary button
app.get ("/summary", function(req, res){
    if (req.isAuthenticated()){
        res.send("This Is Your Quiz Summary Sheet")
    }else{
        res.redirect("/login")
    }
});

// The route to make a signup post request -attached to the signup button on the signup page
app.post("/signup", [
    check("name", "Name should be at least 3 characters").isLength({min: 3}),
    check("email", "Email should be validated").isEmail(),
    check("password", "Password should be at least 6 characters").isLength({min: 6})
    ],
    function(req, res){
    User.register({email: req.body.email}, req.body.password, 
        req.body.name, req.body.church, req.body.number, 
        function(err, user){
        if(err) {
            console.log(err);
        }else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets")
            });
        }
    });
});

// The route to make a login post request -attached to the login button on the login page
app.post("/login", [
    check("email", "Email should be validated").isEmail(),
    check("password", "Password should be at least 6 characters").isLength({min: 6})
    ],
     function(req, res){

    const user = new User({
        email: req.body.email,
        password: req.body.password
    });

    req.login(user, function(err){
        if(err) {
            console.log(err);
        }else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets")
            });
        }
    })
});

// The route to submit quiz code - attached to the submit button on the secret page
app.post("/submit", function(req, res){
    if (req.isAuthenticated()){
        const submittedsecret = req.body.secret;
        User.findById(req.user.id, function(err, foundUser){
            if(err) {
                console.log(err);
            } else {
                if(foundUser) {
                    foundUser.secret = submittedsecret;
                    foundUser.save(function(){
                        res.redirect("/quiz")
                    });
                }
            }
        });
        
       }else{
           res.redirect("/login")
       }
});

// The route to logout
app.post('/logout', function(req, res, next) {
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
  });


  // Creating server
const port = process.env.PORT || 8080;
app.listen(port, () => 
console.log(`Server is running on ${process.env.NODE_ENV} mode on port ${port}`)
);