const express = require('express');

const app = express();
const cors = require('cors');
const bcryptjs = require('bcryptjs');
const moment = require('moment');
app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
   
  res.setHeader('Access-Control-Allow-Origin', 'https://chimerical-brigadeiros-3f98f6.netlify.app/','http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

const mongodb = require('mongodb');
const mongoClient = mongodb.MongoClient;
const dotenv = require('dotenv').config();
const URL = process.env.DB;
const SECRET_KEY=process.env.SECRET_KEY;
const usermail = process.env.USER;
const mailpassword = process.env.PASSWORD
const jwt = require('jsonwebtoken');
const randomstring = require("randomstring");

const rn = require('random-number');
const options = {
    min: 1000,
    max: 9999,
    integer: true
}
const nodemailer = require("nodemailer");


let authenticate = function (request, response, next) {
  if (request.headers.authorization) {
    let verify = jwt.verify(request.headers.authorization, SECRET_KEY);
    console.log(verify);
    if (verify) {
      request.userid = verify.id;

      next();
    } else {
      response.status(401).json({
        message: "Unauthorized",
      });
    }
  } else {
    response.status(401).json({
      message: "Unauthorized",
    });
  }
};



app.get("/", function (request, response) {
    response.send("welcome to Url-Shortener api🎉🎉🎉🎉🎉");
});


//1 register
app.post('/register', async (req, res) => {
    console.log(req.body)
    try {
      const connection = await mongoClient.connect(URL);
      const db = connection.db('password');
      const user = await db.collection('users').findOne({ username: req.body.email });
      if (user) {
        res.json({ message: 'User already exists' });
      } else {
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(req.body.password, salt);
        const newUser = {
          email: req.body.email,
          password: hashedPassword
        };
        await db.collection('users').insertOne(newUser);
        res.json({ message: 'User created and registered successfully' });
      }
      connection.close();
    } catch (error) {
      console.log(error);
      res.json({ message: 'Error creating user' });
    }
  });



  //2.login
  app.post('/login', async (req, res) => {
    try {
      console.log('req.body:', req.body); // check the request body
      const connection = await mongoClient.connect(URL);
      const db = connection.db('password');
      const user = await db.collection('users').findOne({ email: req.body.email });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      console.log('user:', user); // check if the user object is retrieved correctly
      const isPasswordMatch = await bcryptjs.compare(req.body.password, user.password);
      if (!isPasswordMatch) {
        return res.status(401).json({ message: 'Incorrect password' });
      }
      const token = jwt.sign({ _id: user._id, email: user.email }, process.env.SECRET_KEY, { expiresIn: '1h' });
      res.status(200).json({ message: 'Login successful', token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    }
  });


//Verification email
  app.post('/sendmail', async function (req, res) {
    console.log(req.body)
    try {
        const connection = await mongoClient.connect(URL);
        const db = connection.db('password');
        const user = await db.collection('users').findOne({ email: req.body.email });
        if (user) {
            let randomnum = rn(options);

            await db.collection('users').updateOne({ email: req.body.email }, { $set: { rnum: randomnum } });
            var transporter = nodemailer.createTransport({
                service: 'gmail',
                host: "smtp.gmail.com",
                secure: false,
                auth: {
                    user: `${usermail}`,
                    pass: `${mailpassword}`,
                }
            });

            var mailOptions = {
                from: 'santhosh.mech.19@gmail.com',
                to: `${req.body.email}`,
                subject: 'User verification',
                text: `${randomnum}`,
               
            };

            console.log(mailOptions); // add this line to log mailOptions object to console

            await transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                    res.json({
                        message: "Error"
                    })
                } else {
                    console.log('Email sent: ' + info.response);
                    res.json({
                        message: "Email sent"
                    })
                }
            });
        }
        else {
            res.status(400).json({ message: 'User not found' })
        }
    }
    catch (error) {
        console.log(error);
    }
});



// to verify the customer

app.post("/verify", async (req, res) => {
  console.log(req.body)
  try {
      const connection = await mongoClient.connect(URL);
      const db = connection.db('password');
      const user = await db.collection('users').findOne({ email: req.body.email });
      await connection.close();
      if (user.rnum === req.body.vercode) {
          res.status(200).json(user)
      }
      else {
          res.status(400).json({ message: "Invalid Verification Code" })
      }
  } catch (error) {
      console.log(error);
  }
})




// update password

app.post('/changepassword/:id', async function (req, res) {
  console.log(req.params.id)
  try {

      const connection = await mongoClient.connect(URL);
      const db = connection.db('password');
      const salt = await bcryptjs.genSalt(10);
      const hash = await bcryptjs.hash(req.body.password1, salt);
      req.body.password1 = hash;
      delete req.body.password2;
      await db.collection('users').updateOne({ email: req.params.id }, { $set: {password:req.body.password1} });;
      await connection.close();
      res.json({ message: "Password updated successfully" })
  } catch (error) {
      console.log(error);
  }
})


app.post("/enterurl", authenticate, async function (req, res) {
  console.log(req.body)
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db('password');
    if (req.body.longURL == "") {
      res.json({
        message: "Please enter URL",
      });
    } else {
      req.body.created_at = new Date();
      req.body.userid =new mongodb.ObjectId(req.userid);
      let random = randomstring.generate(5);
      req.body.shortURL = `${random}`;// note: when deploy use the deployment link here
      req.body.clicks = 0; 
      const user = await db.collection("urls").insertOne(req.body);

      // Calculate URLs per day and URLs per month
      const currentDate = new Date();
      const urlsPerDay = await db.collection("urls").countDocuments({
        created_at: { 
          $gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()), 
          $lt: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()+1) 
        }
      });
      const urlsPerMonth = await db.collection("urls").countDocuments({
        created_at: {
          $gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
          $lt: new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1)
        }
      });

      // Get the full document with all fields
      const insertedDoc = await db.collection("urls").findOne({_id: user.insertedId});
      const formattedDate = moment(insertedDoc.created_at).format('DD-MM-YYYY HH:mm:ss');
      await connection.close();
      console.log(insertedDoc);
      res.json({
        ...insertedDoc,
        created_at: formattedDate,
        urlsPerDay:parseFloat(urlsPerDay),
        urlsPerMonth:parseFloat(urlsPerMonth)
      });
    }
  } catch (error) {
    console.log(error);
  }
});







app.get("/urls",authenticate, async function(req, res) {
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db('password');
    const urls = await db.collection("urls").find().toArray();

    console.log(urls);

    const currentDate = new Date();
    const urlsPerDay = await db.collection("urls").countDocuments({
      created_at: { $gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()) }
    });

    console.log("urlsPerDay:", urlsPerDay);

    const urlsPerMonth = await db.collection("urls").countDocuments({
      created_at: { $gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1) }
    });

    console.log("urlsPerMonth:", urlsPerMonth);
    
   
    
    await connection.close();

    res.json({
      urls,
      urlsPerDay,
      urlsPerMonth
      
    });
  } catch (error) {
    console.log(error);
  }
});




app.get('/:shortUrl',authenticate, async (req, res) => {
  const shortUrl = req.params.shortUrl;
  console.log(shortUrl);
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db('password');
    const result = await db.collection('urls').findOne({ shortURL: shortUrl });
    await connection.close();
    if (result) {
      console.log(result.longURL);
      res.json({originalURL:result.longURL});
      
    } else {
      res.status(404).send('URL not found');
    }
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error');
  }
});





app.get('/short/:urlredirect',authenticate, async (req, res) => {
  const shortUrl = req.params.urlredirect;
  console.log(req);
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db('password');
    const result = await db.collection('urls').findOne({ shortURL: shortUrl });
   
    if (result) {
      await db.collection('urls').updateOne({ shortURL: shortUrl }, { $inc: { clickCount: +1 } });
      console.log(result.longURL);
      res.redirect(result.longURL);
      
    } else {
      res.status(404).send('URL not found');
    }
    await connection.close();
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error');
  }
});



app.listen(process.env.PORT, () => console.log("Mongo Db Server Started Succesfully", process.env.PORT));