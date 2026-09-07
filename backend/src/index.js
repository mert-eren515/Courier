import { server } from "./app.js";
import { connectDB } from "./lib/db.js";

const PORT = process.env.PORT;

server.listen(PORT, () => {
  console.log("server is running on PORT:" + PORT);
  connectDB();
});
