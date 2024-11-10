// lib/mongodb.js
import mongoose from 'mongoose';

const options = {
    user: process.env.DB_USERNAME,
    pass: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME,
    authSource: process.env.DB_AUTH_SOURCE,
    useNewUrlParser: true,
    useUnifiedTopology: true,
};

// Kiểm tra và lưu trữ kết nối trong biến toàn cục `global`
// `global.mongoose` sẽ được tái sử dụng cho các request tiếp theo trong cùng một instance Lambda.
let isConnected;

async function connectToDatabase() {
    if (isConnected) {
        console.log("⚡️ Sử dụng kết nối MongoDB hiện có");
        return;
    }

    if (!global.mongoose) {
        global.mongoose = mongoose.connect(`mongodb://${process.env.DB_HOST}:${process.env.DB_PORT}`, options);
    }

    try {
        const db = await global.mongoose;
        isConnected = db.connections[0].readyState;
        console.log("✅ Đã kết nối thành công với MongoDB");
    } catch (error) {
        console.error("❌ Lỗi kết nối MongoDB:", error);
        throw new Error("Lỗi kết nối MongoDB");
    }
}

export default connectToDatabase;
