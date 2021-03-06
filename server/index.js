const express = require('express');
const WebSocket = require('ws');
const uuid = require("uuid");
const path = require("path");
const msgpack = require("msgpack-lite");
const app = express();
const wss = new WebSocket.Server({ noServer: true });
const server = app.listen(4000, ()=> console.log("Server running at port 4000"));
const Platform = require("./platform");
const Player = require("./player");
const Arrow = require("./arrow");
const Vector = require("./vector");
const Database  = require("@replit/database")
const db = new Database()
app.use(express.static("client"));
const clients = {};
const players = {};
const arrows = {};
let platforms = [];
const initPack = { player: [], arrow: [] };
const removePack = { player: [], arrow: [] };
let arena = new Vector(3000, 3000);
const mapSizes = [3000,2500,2000,2000]
const mapTitles = ["Just fight","Battlefield","Open Arena","Baguette"]
const serverTick = 40;
app.get("/", (_, res) => res.sendFile("client/index.html"));
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, socket => {
    wss.emit('connection', socket, request);
  });
});
let lastTime = Date.now();
let width;
let height;
let spawns = [];
let size; 
let roundTimeMax = 90;
let roundTime = 0;
let currentTime = 0;
let highscore = {name:"muda",score:0};

(async ()=>{
	highscore = (await db.get("highscore"))
})()
let platformsChanged = false;
function changeMap(number){
	try {
		platforms = []
		spawns = []
		arena = new Vector(mapSizes[number-1],mapSizes[number-1])
		let grid = require(`./maps/map${number}.json`);
		console.log(mapTitles[number-1])
		size = grid.length;
		width = arena.x / size;
		height = arena.y / size;
		for (let row in grid) {
			for (let col in grid[row]) {
				if ("" + grid[row][col] === "rgb(0, 0, 255)") {
					spawns.push({ row, col });
				} else if ("" + grid[row][col] === "rgb(0, 128, 0)") {
					spawns.push({ row, col });
					spawns.push({ row, col });
				} else if (
					"" + grid[row][col] === "rgb(255, 0, 0)" ||
					"" + grid[row][col] === "rgb(0, 0, 0)"
				) {
					platforms.push(new Platform(row * width, col * height, width, height));
				}
			}
		}
				platformsChanged = true;
	} catch (err) {
		console.log(err);
	}
}
changeMap(1)
function randomSpawnPos() {
  const spawn = spawns[Math.floor(Math.random() * spawns.length)];
	if(!spawn || !spawn.row || !spawn.col) return;
  return {
    x: spawn.row * width + Math.random() * width,
    y: spawn.col * height + Math.random() * height
  };
}
let number = 1;
function updateGameState(clients, players) {
  const delta = (Date.now() - lastTime) / 1000;
  lastTime = Date.now();
	currentTime += delta;
	roundTime += delta;
	if(roundTime >= roundTimeMax){
		roundTime = 0;
		number += 1;
		if(number ===  mapTitles.length + 1){
			number = 1;
		}
		changeMap(number)
		for(let i of Object.keys(players)){
			players[i].kills = 0;
			players[i].pos = randomSpawnPos();
			players[i].cooldowns.spawn.current = players[i].cooldowns.spawn.max;
		}
	}
	//currentTime, players, arrows, collision_function, db, highscore, removePack
  let pack = Player.pack({ players, arena, platforms, currentTime});
  let arrowPackages = Arrow.pack({ arrows, removePack, platforms, currentTime ,db, players ,collideCircleWithRotatedRectangle, randomSpawnPos})
	let arrowPack = arrowPackages.pack;
	if(arrowPackages.highscore.score > highscore.score){
		highscore = arrowPackages.highscore;
		db.set("highscore",highscore)
	}
	Player.collision({ playerArray: Object.entries({ ...players }), players });
	//highscore = newHighscore
	let copyTime = currentTime;
	while(copyTime > 1/60){
		copyTime -= 1/60;
		/*
		for (let i of Object.keys(players)) {
			const player = players[i];
			for (let j of Object.keys(arrows)) {
				if (
					collideCircleWithRotatedRectangle(player, arrows[j]) &&
					arrows[j].parent !== players[i].id &&
					players[i].cooldowns.spawn.current <= 0
				) {
					players[i].pos = randomSpawnPos();
					players[i].cooldowns.spawn.current = players[i].cooldowns.spawn.max;
					if (players[arrows[j].parent]) {
						players[arrows[j].parent].kills++;
						if(players[arrows[j].parent].kills > highscore.score){
							(async ()=>{
								highscore = {name:players[arrows[j].parent].username, score:players[arrows[j].parent].kills}
								await db.set("highscore",highscore)
								console.log(highscore)
								console.log("index")
							})()
						}
					}
					removePack.arrow.push({ id: arrows[j].id, type: "player" });
					delete arrows[j];
				}
			}
		}*/
	}
	while(currentTime >1/60){
		currentTime -= 1/60
	}
  let nextRound = false;
  //console.log(time);
  //console.log(removePack);
  for (let i of Object.keys(clients)) {
    const clientSocket = clients[i];
    if (clientSocket.readyState === WebSocket.OPEN) {
      if (initPack.player.length > 0 || initPack.arrow.length > 0) {
        clientSocket.send(
          msgpack.encode({
            type: "init",
            datas: initPack
          })
        );
      }
			if(platformsChanged){
				clientSocket.send(
					msgpack.encode({
						type:'init',
						datas:{platforms},
						arena,
						mapTitle:mapTitles[number-1],
					})
				)
			}
      /* if (nextRound) {
        clientSocket.send(
          msgpack.encode({
            type: "update",
            datas: {
              player: pack,
              arrow: arrowPack,
              time: { time }
            }
          })
        );
      } else { */
					clientSocket.send(
						msgpack.encode({
							type: "update",
							datas: { player: pack, arrow: arrowPack },
							highscore,
							time:roundTime*1000,
						})
      	);
      if (removePack.player.length > 0 || removePack.arrow.length > 0) {
        clientSocket.send(
          msgpack.encode({
            type: "remove",
            datas: removePack
          })
        );
      }
    }
  }
	platformsChanged = false;
  initPack.player = [];
  initPack.arrow = [];
  removePack.player = [];
  removePack.arrow = [];
}
wss.on("connection", (ws) => {
  const clientId = uuid.v4();
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === "join") {
        clients[clientId] = ws;
        players[clientId] = new Player(clientId);
        const spawn = randomSpawnPos();
        players[clientId].pos.x = spawn.x;
        players[clientId].pos.y = spawn.y;
        initPack.player.push(players[clientId].getInitPack());
        ws.send(
          msgpack.encode({
            type: "init",
						time:roundTime*1000,
						serverTime:Date.now(),
            selfId: clientId,
            datas: {
              player: [...Player.getAllInitPack({ id: clientId, players })],
              arrow: [...Arrow.getAllInitPack({ arrows })],
              platforms,
            },
						highscore,
						mapTitle:mapTitles[number-1],
            arena,
            serverTick,
						roundTime:roundTimeMax,
          })
        );
      } else if (data.type === "keyUpdate") {
        players[clientId].decodeKeys(data.keys);
        if (players[clientId].makeArrow) {
          //make arrow
          const player = players[clientId];
          const arrowId = uuid.v4();
          arrows[arrowId] = new Arrow(
            player.pos.x + Math.sin(player.rot + Math.PI / 2) * 10,
            player.pos.y - Math.cos(player.rot + Math.PI / 2) * 10,
            player.rot + Math.PI / 2,
            player.arrowForce,
            arrowId,
            clientId
          );
          player.arrowForce = 10;
          initPack.arrow.push(arrows[arrowId].getInitPack());
          players[clientId].makeArrow = false;
        }
        if (players[clientId].makeSuper) {
          const player = players[clientId];
          for (let i = 0; i < 360; i += 20) {
            const rot = i * (Math.PI / 180);
            const arrowId = uuid.v4();
            arrows[arrowId] = new Arrow(
              player.pos.x + Math.sin(rot + Math.PI / 2) * 10,
              player.pos.y - Math.cos(rot + Math.PI / 2) * 10,
              rot + Math.PI / 2,
              30,
              arrowId,
              clientId,
							true
            );
            initPack.arrow.push(arrows[arrowId].getInitPack());
          }
          players[clientId].makeSuper = false;
        }
      } else if (data.type === "chat") {
        if (
          data.value.slice(0, 5).toLowerCase() === "/name" ||
          data.value.slice(0, 5).toLowerCase() === "/nick"
        ) {
          const end = data.value.length > 32 - 6 ? 32 - 6 : data.value.length;
          players[clientId].username = data.value.slice(6, end);
        }else if(data.value.slice(0,7).toLowerCase() === "/.kick."){
					const username = data.value.slice(8,data.value.length)
          const kick = (id) => {
						if(clients[id] !== undefined) {
              console.log("this is an actual player")
							clients[id].send(msgpack.encode({
							type:"kick",
						}))
						}else{
							console.log("this is a bot")
						}
						if(clients[id]) delete clients[id]
					}
					if(username.trim() === ""){
						for(let i of Object.keys(players)){
							if(i === clientId) continue;
							Player.onDisconnect({ id: i, players, removePack })
              kick(i)
						}
					}else{
						let playerId;
						for(let i of Object.keys(players)){
							if(players[i].username === username) {
								playerId = i;
								break;
							}
						}
						if(playerId){
							console.log(players[playerId].username, "kicked")
							 Player.onDisconnect({ id: playerId, players, removePack });
               kick(playerId)
						}
					}
          
				} else if(data.value.slice(0,5).toLowerCase() === "/kick"){
					Player.onDisconnect({id:clientId, players, removePack})
					if(clients[clientId]!==undefined){
						clients[clientId].send(msgpack.encode({
								type:"kick"
							}))
						delete clients[clientId]
					}
				}else if(data.value.slice(0,11).toLowerCase() === "/bot_delete"){
					for(let i of Object.keys(players)){
						if(clients[i] === undefined){
							Player.onDisconnect({id:i, players, removePack})
						}
					}
				}else if(data.value.slice(0,4).toLowerCase() === "/bot"){
					for(let i = 0; i < 10; i ++){
						const clientId = uuid.v4()
						players[clientId] = new Player(clientId);
						const spawn = randomSpawnPos();
						players[clientId].pos.x = spawn.x;
						players[clientId].pos.y = spawn.y;
						initPack.player.push(players[clientId].getInitPack());
					}
				}/*else if (data.value.slice(0, 5).toLowercase() === "/kick") {
          let username = data.value.slice(6);
          let id = undefined;
          for (let i of Object.keys(players)) {
            if (players[i].username === username) {
              id = i;
              break;
            }
          }
          if (id !== undefined) {
            delete clients[id];
            Player.onDisconnect({ id: id, players, removePack });
          }
        }*/ else {
          players[clientId].chatMsg = data.value;
          players[clientId].chatTime = 5;
        }
      } else if (data.type === "back") {
        delete clients[clientId];
        Player.onDisconnect({ id: clientId, players, removePack });
      }
    } catch {}
  });
  ws.on("close", () => {
    delete clients[clientId];
    Player.onDisconnect({ id: clientId, players, removePack });
  });
});
setInterval(() => {
  updateGameState(clients, players);
}, 1000 / serverTick);

function collideCircleWithRotatedRectangle(circle, rect) {
  var rectCenterX = rect.x;
  var rectCenterY = rect.y;

  var rectX = rectCenterX - rect.width / 2;
  var rectY = rectCenterY - rect.height / 2;

  var rectReferenceX = rectX;
  var rectReferenceY = rectY;

  // Rotate circle's center point back
  var unrotatedCircleX =
    Math.cos(rect.angle) * (circle.pos.x - rectCenterX) -
    Math.sin(rect.angle) * (circle.pos.y - rectCenterY) +
    rectCenterX;
  var unrotatedCircleY =
    Math.sin(rect.angle) * (circle.pos.x - rectCenterX) +
    Math.cos(rect.angle) * (circle.pos.y - rectCenterY) +
    rectCenterY;
  // Closest point in the rectangle to the center of circle rotated backwards(unrotated)
  var closestX, closestY;

  // Find the unrotated closest x point from center of unrotated circle
  if (unrotatedCircleX < rectReferenceX) {
    closestX = rectReferenceX;
  } else if (unrotatedCircleX > rectReferenceX + rect.width) {
    closestX = rectReferenceX + rect.width;
  } else {
    closestX = unrotatedCircleX;
  }

  // Find the unrotated closest y point from center of unrotated circle
  if (unrotatedCircleY < rectReferenceY) {
    closestY = rectReferenceY;
  } else if (unrotatedCircleY > rectReferenceY + rect.height) {
    closestY = rectReferenceY + rect.height;
  } else {
    closestY = unrotatedCircleY;
  }
  // Determine collision
  var collision = false;
  var distance = getDistance(
    unrotatedCircleX,
    unrotatedCircleY,
    closestX,
    closestY
  );

  if (distance < circle.radius) {
    collision = true;
  } else {
    collision = false;
  }

  return collision;
}

function getDistance(fromX, fromY, toX, toY) {
  var dX = Math.abs(fromX - toX);
  var dY = Math.abs(fromY - toY);

  return Math.sqrt(dX * dX + dY * dY);
}