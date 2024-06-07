// Adjusted API Routes
const express = require('express');
const pool = require('./db');
const router = express.Router();

// Get book based on author or title keyword
router.get('/Books', async (req, res) => {
  const { Author, "Title Keyword": TitleKeyword } = req.query;

  try {
    const client = await pool.connect();
    let query = "SELECT * FROM \"Book\"";
    const params = [];

    if (Author) {
      query += " WHERE \"Author\" = $1";
      params.push(Author);
    } else if (TitleKeyword) {
      query += " WHERE \"Title\" ILIKE $1";
      params.push(`%${TitleKeyword}%`);
    }

    const result = await client.query(query, params);
    res.json(result.rows);
    client.release();
  } catch (err) {
    res.status(500).send(err.message);
  }
});


// Add a book to user wishlist
router.post('/Wishlist', async (req, res) => {
  const { Username, Author, "Book Title": BookTitle } = req.body;

  const selectUserQuery = `
    SELECT "Username"
    FROM "User"
    WHERE "Username" = $1;
  `;

  const selectBookQuery = `
    SELECT "Title"
    FROM "Book"
    WHERE "Title" = $1 AND "Author" = $2;
  `;

  const insertWishlistQuery = `
    INSERT INTO "Wishlist"("Wishlist ID", "Username", "Book Title", "Created at")
    VALUES ($1, $2, $3, TO_CHAR(CURRENT_DATE, 'DD-MM-YYYY'));
  `;

  let client;

  try {
    client = await pool.connect();

    // Begin transaction
    await client.query('BEGIN');

    // Check if user exist
    const userResult = await client.query(selectUserQuery, [Username]);
    if (userResult.rows.length === 0) {
      throw new Error('User does not exist');
    }

    // Check if book title with the corresponding author exist
    const bookResult = await client.query(selectBookQuery, [BookTitle, Author]);
    if (bookResult.rows.length === 0) {
      throw new Error('Book does not exist');
    }

    // Insert to wishlist
    const wishlistIDResult = await client.query('SELECT COALESCE(MAX("Wishlist ID"), 0) + 1 AS "Wishlist ID" FROM "Wishlist"');
    const wishlistID = wishlistIDResult.rows[0]['Wishlist ID'];

    await client.query(insertWishlistQuery, [wishlistID, Username, BookTitle]);

    // Commit transaction
    await client.query('COMMIT');

    res.status(201).json({ status: 'success' });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    res.status(500).send(err.message);
  } finally {
    if (client) {
      client.release();
    }
  }
});


// Add or update book stock in the store
router.post('/Stock', async (req, res) => {
  const { "Book Title": BookTitle, Quantity, "Store Name": StoreName } = req.body;

  const client = await pool.connect();
  try {
    // Retrieve Book ID
    const bookQuery = 'SELECT \"Book ID\" FROM \"Book\" WHERE \"Title\" = $1';
    const bookResult = await client.query(bookQuery, [BookTitle]);
    if (bookResult.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    const BookID = bookResult.rows[0]["Book ID"];

    // Retrieve Store ID based on Store Name
    const storeQuery = 'SELECT \"Store ID\" FROM \"Store\" WHERE \"Name\" = $1';
    const storeResult = await client.query(storeQuery, [StoreName]);
    if (storeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }
    const StoreID = storeResult.rows[0]["Store ID"];

    // Check if stock entry exists
    const stockQuery = 'SELECT \"Stock ID\", \"Quantity Available\" FROM \"Stock\" WHERE \"Store ID\" = $1 AND \"Book ID\" = $2';
    const stockResult = await client.query(stockQuery, [StoreID, BookID]);

    if (stockResult.rows.length > 0) {
      // Update existing stock
      const StockID = stockResult.rows[0]["Stock ID"];
      const newQuantity = stockResult.rows[0]["Quantity Available"] + Quantity;
      const updateQuery = 'UPDATE \"Stock\" SET \"Quantity Available\" = $1, \"Last Updated\" = TO_CHAR(CURRENT_DATE, \'DD-MM-YYYY\') WHERE \"Stock ID\" = $2';
      await client.query(updateQuery, [newQuantity, StockID]);
    } else {
      // Insert new stock entry
      const insertQuery = `
        INSERT INTO \"Stock\" (\"Store ID\", \"Book ID\", \"Quantity Available\", \"Last Updated\")
        VALUES ($1, $2, $3, TO_CHAR(CURRENT_DATE, 'DD-MM-YYYY'))
      `;
      await client.query(insertQuery, [StoreID, BookID, Quantity]);
    }

    res.status(201).json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


// Update user password
router.put('/User/Account', async (req, res) => {
  const { Username, Email, "Old Password": OldPassword, "New Password": NewPassword } = req.body;

  const selectUserQuery = `
    SELECT \"Username\"
    FROM \"User\"
    WHERE \"Username\" = $1 AND \"Email\" = $2 AND \"Password\" = $3
  `;

  const updateUserPasswordQuery = `
    UPDATE \"User\"
    SET \"Password\" = $1
    WHERE \"Username\" = $2 AND "Email" = $3
  `;

  try {
    const client = await pool.connect();

    // Begin transaction
    await client.query('BEGIN');

    // Verify user credentials
    const userResult = await client.query(selectUserQuery, [Username, Email, OldPassword]);
    if (userResult.rows.length === 0) {
      throw new Error('Invalid username, email, or old password');
    }

    // Update user password
    await client.query(updateUserPasswordQuery, [NewPassword, Username, Email]);

    // Commit transaction
    await client.query('COMMIT');

    res.status(200).json({ status: 'success' });
    client.release();
  } catch (err) {
    // Rollback transaction in case of error
    await client.query('ROLLBACK');
    res.status(500).send(err.message);
  } 
});


// Get book reviews based on keywords
router.get('/Reviews', async (req, res) => {
  const { Keyword } = req.query;

  try {
    const client = await pool.connect();
    let query = "SELECT * FROM \"Review\"";
    const params = [];

    if (Keyword) {
      query += " WHERE \"Book Title\" ILIKE $1";
      params.push(`%${Keyword}%`);
    }

    const result = await client.query(query, params);
    res.json(result.rows);
    client.release();
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
