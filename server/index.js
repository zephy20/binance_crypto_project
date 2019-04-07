const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
var http = require("http");
const axios = require("axios");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
const binanceRoute = require("./api/routes");
var server = http.createServer(app);
const Binance = require("node-binance-api");
const binance = new Binance();
const moment = require("moment");
var path = require("path");

app.use("/binance", binanceRoute);

// app.use(express.static(path.join(__dirname, "../binance-exchange/build")));
const staticFiles = express.static(path.join(__dirname, "../../client/build"));
app.use(staticFiles);
// if (process.env.NODE_ENV === "production") {
//   app.use(express.static(path.join(__dirname, "../binance-exchange/build")));
//   //
//   app.get("*", (req, res) => {
//     res.sendfile(
//       path.join((__dirname = "../binance-exchange/build/index.html"))
//     );
//   });
// }

// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname + "../binance-exchange/build/index.html"));
// });

server.listen(port, err => {
  if (err) {
    console.log(err);
  }
  console.log("Listening on port " + port);
});

const io = require("socket.io")(server);

io.on("connection", socket => {
  var symbolData = {};
  socket.on("symbol", data => {
    binance.prices(data, (error, ticker) => {
      socket.emit("symbolprice", ticker);
    });
    binance.websockets.prevDay(data, (error, response) => {
      symbolData = {
        priceChange: response
      };
      socket.emit("symboldata", response);
    });
  });

  socket.on("tradehistory", data => {
    binance.websockets.trades([data], trades => {
      var tradeData = {};
      let {
        e: eventType,
        E: eventTime,
        s: symbol,
        p: price,
        q: quantity,
        m: maker,
        a: tradeId
      } = trades;
      tradeData = {
        price: price,
        quantity: parseFloat(quantity).toFixed(3),
        time: moment(eventTime).format("HH:mm:ss")
      };
      socket.emit("tradehistory", tradeData);
    });
  });

  socket.on("chartdata", data => {
    var chartdata = {};
    binance.websockets.candlesticks(data, "1m", candlesticks => {
      let { e: eventType, E: eventTime, s: symbol, k: ticks } = candlesticks;
      let {
        o: open,
        h: high,
        l: low,
        c: close,
        v: volume,
        n: trades,
        i: interval,
        x: isFinal,
        q: quoteVolume,
        V: buyVolume,
        Q: quoteBuyVolume
      } = ticks;

      chartdata = {
        date: moment(eventTime).toDate(),
        open: open,
        high: high,
        low: low,
        close: close,
        volume: volume
      };

      socket.emit("chartdata", chartdata);
    });
  });

  socket.on("symbol", data => {
    binance.websockets.chart(data, "1m", (symbol, interval, chart) => {
      let tick = binance.last(chart);
      const last = chart[tick].close;

      socket.emit("lastprice", last);
    });
  });

  socket.on("disconnect", () => {
    // the connection has ended
  });
});
