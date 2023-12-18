// /api/scrape.js

const axios = require('axios');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const cuid = require('cuid');
require('dotenv').config();

const URL = 'https://www.cheapies.nz/';

// Function to resolve the final URL
async function resolveFinalURL(url) {
  try {
    const response = await axios.get(url, {
      maxRedirects: 5,
      timeout: 10000, // 10 seconds timeout
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        // Add other headers as needed
      },
    });
    return response.request.res.responseUrl;
  } catch (error) {
    return url; // Return the original URL in case of an error
  }
}

module.exports = async (req, res) => {
  const connection = await mysql.createConnection(
    process.env.DATABASE_URL_PRODUCTION
  );

  try {
    const response = await axios.get(URL);
    const $ = cheerio.load(response.data);

    const item = $('.node-teaser');
    const posts = [];

    for (let index = 0; index < Math.min(item.length, 6); index++) {
      const element = item[index];

      let titleElement = $(element).find('h2.title a').text();
      let descriptionElement = $(element).find('div.content p').text();
      let imageElement = $(element)
        .find('div.foxshot-container img')
        .attr('src');
      let couponElement = $(element).find('.couponcode strong').text();
      let voteElement = $(element).find('.voteup span').text();
      let linkElement = $(element).find('span.via a');
      let priceElement = $(element).find('em.dollar').text().replace('$', '');

      const shortURL = 'https://www.cheapies.nz' + $(linkElement).attr('href');
      const finalURL = await resolveFinalURL(shortURL);

      const post = {
        id: cuid(),
        title: titleElement,
        description: descriptionElement,
        image: imageElement,
        link: finalURL,
        coupon: couponElement,
        votes: voteElement,
        sourceLink: shortURL,
        price: priceElement,
      };

      posts.push(post);
    }

    for (const post of posts) {
      const [results] = await connection.query(
        'SELECT * FROM Post WHERE sourceLink = ?',
        [post.sourceLink]
      );

      if (results.length === 0) {
        const insertQuery = `INSERT INTO Post (id, title, content, createdAt, updatedAt, authorId, categoryId, link, image, coupon, postStatusId, sourceLink, price, sourceVotes) VALUES (?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await connection.query(insertQuery, [
          post.id,
          post.title,
          post.description,
          'clj3ifrcy0000ovijlsulaw3l', // Example authorId
          'cljumct490001ovdzauew42zh', // Example categoryId
          post.link,
          post.image,
          post.coupon,
          'clq8yxkva0000ovvxj03b2bmo', // Example postStatusId
          post.sourceLink,
          post.price,
          post.votes,
        ]);
      }
    }

    res.status(200).send('Scrape completed successfully');
  } catch (error) {
    console.error('Error during scraping:', error);
    res.status(500).send('Error during scraping');
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};
