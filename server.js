require('dotenv').config()
const express = require("express");
const mongojs = require("mongojs");
const https = require('https');
var cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');
const DB_USER = process.env.MONGO_DB_USER;
const DB_PASSOWRD = process.env.MONGO_DB_PW;
const PORT = process.env.PORT;
const uri = `mongodb+srv://${DB_USER}:${DB_PASSOWRD}@cluster0.4tm4bhq.mongodb.net/?retryWrites=true&w=majority`;


var app = express();
app.use(express.static("public"));
app.use(cors());

var databaseUrl = "gameData";
var collections = ["games"];

var db = mongojs(databaseUrl, collections);

db.on("error", function(error) {
  console.log("Database Error:", error);
});

const axios = require('axios');

const getScoresFromApi = async(gameId) => {
  const scoreDaata = await axios.get(`https://chumley.barstoolsports.com/dev/data/games/${gameId}.json`)
  .then(res => {
    const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';
    return res.data;
  })
  .catch(err => {
    console.log('Error: ', err.message);
  });
  return scoreDaata;
}

async function getGameData(gameId) {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true },{
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });
  try {
    await client.connect();
    const games = client.db(databaseUrl).collection(collections[0]);
    const gameData = await games.findOne({ game_id: gameId });
    var scoreObject;
    if(!gameData){
      try{
        const scoreData = await getScoresFromApi(gameId);
        scoreObject = scoreData;
        // scoreObject = { "game_id": gameId, "league": scoreData.league, "status": scoreData.event_information.status, "home_team": scoreData.home_team, "away_team": scoreData.away_team, "away_period_scores": scoreData.away_period_scores, "home_period_scores": scoreData.home_period_scores, "last_updated":(Date.now()/1000).toFixed()}
        await client.db(databaseUrl).collection(collections[0]).insertOne(
          {"game_id": gameId,"last_updated":(Date.now()/1000).toFixed(), ...scoreObject}
          );
      } catch(exception){
        console.log("ERROR FETCHING DATA FOR ID "+gameId);
      }
    } else if(Number(gameData.last_updated) + 15 < (Date.now()/1000).toFixed()) {
      const scoreData = await getScoresFromApi(gameId);
      scoreObject = scoreData;
      await client.db(databaseUrl).collection(collections[0]).replaceOne(
        {"game_id" : gameId },
        {"game_id": gameId, "last_updated":(Date.now()/1000).toFixed(),...scoreData}
     );
    }else {
      scoreObject = gameData;
    }
  } finally {
    await client.close();
    return scoreObject;
  }
  
}
app.get("/games", async function(req,res){
  const game = await getGameData(req.query.gameId);
  res.send(game)
})

// Listen on port 3000
app.listen(PORT, function() {
  console.log(`Listening on port ${PORT} .`);
});