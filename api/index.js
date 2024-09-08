require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");
const User = require('./models/User');
const Post = require('./models/Post');
const Disease = require('./models/Disease');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const uploadMiddleware = multer({ dest: 'uploads/' });
const fs = require('fs');

const app = express();
const salt = bcrypt.genSaltSync(10);
const secret = process.env.JWT_SECRET;

app.use(cors({credentials:true,origin:'http://localhost:3000'}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

mongoose.connect(process.env.MONGODB_URI);

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (e) {
    console.log(e);
    res.status(400).json(e);
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
      if (err) throw err;
      res.cookie('token', token).json({
        id: userDoc._id,
        username,
      });
    });
  } else {
    res.status(400).json('wrong credentials');
  }
});

app.get('/profile', (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
});

app.post('/logout', (req, res) => {
  res.cookie('token', '').json('ok');
});

app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { title, summary, content, tags } = req.body;

    let cover = null;
    if (req.file) {
      cover = fs.readFileSync(req.file.path); // Read the file data
      fs.unlinkSync(req.file.path); // Delete the file after reading
    }

    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover,
      author: info.id,
      tags: tags.split(','),
    });

    // Enforce limit of 150 posts
    const totalPosts = await Post.countDocuments();
    if (totalPosts > 150) {
      const oldestPost = await Post.findOne().sort({ createdAt: 1 });
      await Post.deleteOne({ _id: oldestPost._id });
    }
    res.json(postDoc);
  });
});

app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    newPath = path + '.' + ext;
    fs.renameSync(path, newPath);
  }

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { id, title, summary, content, tags } = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json('you are not the author');
    }
    await postDoc.updateOne({
      title,
      summary,
      content,
      cover: newPath ? fs.readFileSync(newPath) : postDoc.cover, // Read the file data if newPath is set
      tags: tags ? tags.split(',') : postDoc.tags,
    });

    res.json(postDoc);
  });
});

app.get('/posts', async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const query = search ? {
    $or: [
      { title: new RegExp(search, 'i') },
      { tags: new RegExp(search, 'i') }
    ]
  } : {};

  const posts = await Post.find(query)
    .populate('author', ['username'])
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const totalPosts = await Post.countDocuments(query);
  const totalPages = Math.ceil(totalPosts / limit);

  res.json({ posts, totalPages }); // Return totalPages along with posts
});

// Define the route for suggestions
app.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    const posts = await Post.find({
      $or: [
        { title: new RegExp(q, 'i') },
        { tags: new RegExp(q, 'i') }
      ]
    }).limit(5).populate('author', 'username'); // Populate author's username

    const suggestions = posts.map(post => ({
      title: post.title,
      author: post.author,
      tags: post.tags
    }));

    res.json(suggestions);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/post/:id', async (req, res) => {
  const { id } = req.params;
  const postDoc = await Post.findById(id).populate('author', ['username']);
  res.json(postDoc);
});


app.delete('/post/:id', async (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { id } = req.params;
    const postDoc = await Post.findById(id);
    if (postDoc.author.toString() === info.id) {
      await postDoc.deleteOne();
      res.json('Post deleted');
    } else {
      res.status(403).json({ error: 'Unauthorized' });
    }
  });
});



// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});