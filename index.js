require('dotenv').config();
const cuid = require('cuid');

const axios = require('axios');
const cheerio = require('cheerio');

const URL = 'https://www.cheapies.nz/';
const mysql = require('mysql2');
const connection = mysql.createConnection(process.env.DATABASE_URL);

axios
  .get(URL)
  .then((response) => {
    const $ = cheerio.load(response.data);

    const item = $('.node-teaser');

    const posts = [];

    for (let index = 0; index < Math.min(item.length, 3); index++) {
      const element = item[index];

      let titleElement = $(element).find('h2.title a').text();
      let descriptionElement = $(element).find('div.content p').text();
      let imageElement = $(element)
        .find('div.foxshot-container img')
        .attr('src');
      let couponElement = $(element).find('.couponcode strong').text();
      let voteElement = $(element).find('.voteup span').text();
      let linkElement = $(element).find('span.via a');
      let priceElement = $(element).find('em.dollar').text();

      const shortURL = 'https://www.cheapies.nz' + $(linkElement).attr('href');

      const post = {
        id: cuid(),
        title: titleElement,
        description: descriptionElement,
        image: imageElement,
        link: shortURL,
        coupon: couponElement,
        votes: voteElement,
        sourceLink: shortURL,
        price: priceElement,
      };

      posts.push(post);
    }

    posts.forEach((post) => {
      // First, check if the post with the same sourceLink already exists
      const checkQuery = 'SELECT * FROM Post WHERE sourceLink = ?';
      connection.query(checkQuery, [post.sourceLink], (err, results) => {
        if (err) throw err;

        // If the post does not exist, insert it
        if (results.length === 0) {
          const insertQuery = `INSERT INTO Post (id, title, content, createdAt, updatedAt, authorId, categoryId, link, image, coupon, postStatusId, sourceLink, price) VALUES (?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?, ?)`;

          connection.query(
            insertQuery,
            [
              post.id,
              post.title,
              post.description,
              'clj3ifrcy0000ovijlsulaw3l',
              'cljumct490001ovdzauew42zh',
              post.link,
              post.image,
              post.coupon,
              'cljbxgz0o0000ovsazmpp3edc',
              post.sourceLink,
              post.price,
            ],
            (insertErr, insertResults) => {
              if (insertErr) throw insertErr;
              console.log('Post inserted successfully');
            }
          );
        } else {
          console.log('Post already exists');
        }
      });
    });

    // console.log(posts);
  })
  .catch((error) => {
    console.error('Error fetching website:', error);
  });
