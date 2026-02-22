import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "Neocode-v2",
    password: process.env.DB_PASSWORD || "1234",
    port: parseInt(process.env.DB_PORT) || 5432,
});

// console.log("Connected to DB:", process.env.DB_HOST);

async function connection() {
    try {
        await pool.connect();
        console.log("Database Successfully Connected");
    } catch (error) {
        console.log("Database not connected");
        console.log(error);
    }
}

export default connection;
export { pool };
