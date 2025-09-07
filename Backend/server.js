const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const laundryRoutes = require("./routes/laundryRoutes");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Use laundry routes
app.use("/api", laundryRoutes);

// Simple root route so visiting http://localhost:5000/ returns a helpful message
app.get('/', (req, res) => {
	res.send('Laundry Management API is running. Use /api for endpoints.');
});

app.listen(5000, () => console.log("Server running on port 5000"));
