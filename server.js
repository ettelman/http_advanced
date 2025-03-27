const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const app = express();
const port = 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sätt key för session till något relativt säkert
app.use(
  session({
    secret: "mySuperSecretKey",
    resave: false,
    saveUninitialized: true,
  }),
);

app.use(express.static(path.join(__dirname, "public")));

// Fake robots.txt
app.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  res.send("User-agent: *\nDisallow: /api\n");
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Första flaggan i en cookie
app.get("/attack", (req, res) => {
  res.cookie("secret", "FLAGGA1{COOKIE_MONSTER}");
  res.sendFile(path.join(__dirname, "public", "attack.html"));
});

// Flagga vid /api/query?query=flag
app.get("/api/query", (req, res) => {
  if (req.query.query === "flag") {
    res.send("FLAGGA4{QUERY_SUCCESS}");
  } else {
    res.sendFile(path.join(__dirname, "public", "querythisbro.html"));
  }
});

app.get("/api/start", (req, res) => {
  res.send(`APIer kan stödja både POST och GET på "samma endpoint"`);
});

app.post("/api/start", (req, res) => {
  res.send(`112263`);
});

// base64 encodad flagga i etag
app.get("/112263", (req, res) => {
  const flag = "FLAGGA3{ETAG_SECRET}";
  const encodedFlag = Buffer.from(flag).toString("base64");
  res.set("ETag", encodedFlag);
  res.sendFile(path.join(__dirname, "public", "112263.html"));
});

app.post("/processCommand", (req, res) => {
  const { command } = req.body;
  let output = "";

  switch (command.toLowerCase()) {
    case "help":
      output =
        "Tillgängliga kommandon: help, info, clear, ls, neofetch, cat, ping";
      break;
    case "info":
      output = "HTTP CTF - Version 1.0";
      break;
    case "clear":
      output = "clear";
      break;
    case "ls":
      output = "flag.txt   run   readme.md   secret.txt";
      break;
    case "cat flag.txt":
      // dubbel encodad flagga
      output =
        "%64%47%68%6c%63%6d%55%67%61%58%4d%67%62%6d%38%67%5a%6d%78%68%5a%77%3d%3d";
      break;
    case "cat run":
      output = "can't cat binary";
      break;
    case "cat readme.md":
      output = "Hint: /api innehåller ett API --- Starta på api/start";
      break;
    case "there is no flag":
      output = "FLAGGA2{URL-ENCODED-DATA}";
      break;
    case "neofetch":
      output =
        "Kali Linux - Minimal version\nKernel: 5.10.0-kali\nUptime: 3 days, 4 hours\nCPU: Intel(R) Core(TM) i7\nRAM: 16GB";
      break;
    case "cat secret.txt":
      output = "empty";
      break;
    case "./run":
      output = "I can run a marathon! How far is that?!";
      break;
    case "ping 10.3.10.182:6969":
      output =
        "64 bytes from 10.3.10.182:6969/api/query: icmp_seq=1 ttl=63 time=88.1 ms";
      break;
    case "ping":
      output = "usage: ping ip:port";
      break;
    case "42":
      output = "The answer to life, the universe, and everything is 42(km?).";
      break;
    case "42km":
      output =
        "The answer to life, the universe, and everything is 42(km?). FLAGGA5{42km}";
      break;
    default:
      output = `Okänt kommando: '${command}'. Skriv 'help' för att få en lista på kommandon.`;
      break;
  }

  res.json({ output });
});

// Lista över korrekta flaggor
const correctFlags = [
  "COOKIE_MONSTER",
  "URL-ENCODED-DATA",
  "ETAG_SECRET",
  "QUERY_SUCCESS",
  "42km",
];

/*
 * Highscore-objekt:
 * Nyckeln är elevens namn och värdet är ett objekt:
 * { count: antal flaggor, fiveSubmission: timestamp när 5 flaggor submittades (för tie-break) }
 * Knappast det smartaste sättet, men snabbt att implementera
 */
const highscore = {};

/*
 * Endpoint för flagga-submission (en flagga i taget)
 * Förväntar sig ett JSON-objekt: { name: "Elevens namn", flag: "FLAGGAvärde" }
 */
app.post("/submit", (req, res) => {
  const { name, flag } = req.body;

  if (!name || !flag) {
    return res.json({
      success: false,
      message: "Både namn och flagga måste skickas med.",
    });
  }

  // Spara elevens namn och redan submittade flaggor i sessionen
  if (!req.session.name) {
    req.session.name = name;
    req.session.submittedFlags = [];
  }

  // Om sessionen redan är kopplad till ett annat namn
  if (req.session.name !== name) {
    return res.json({
      success: false,
      message:
        "Du har redan påbörjat en session med ett annat namn. Sluta fuska annars blir du bannad :)",
    });
  }

  // Kolla om flaggan redan skickats in av denna elev
  if (req.session.submittedFlags.includes(flag)) {
    return res.json({
      success: false,
      message: "Du har redan submittat denna flagga.",
    });
  }

  // Kolla om flaggan är korrekt
  if (!correctFlags.includes(flag)) {
    return res.json({
      success: false,
      message: "Flaggan är felaktig. Försök igen!",
    });
  }

  // Flaggan är korrekt och ny, lägg till den i sessionen
  req.session.submittedFlags.push(flag);
  const count = req.session.submittedFlags.length;

  // Uppdatera highscore-listan:
  // Om eleven inte finns i highscore-objektet, lägg till med aktuellt värde.
  // Om eleven precis har nått 5 flaggor, spara tiden då de nådde 5 (om det inte redan är sparat)
  if (!highscore[name]) {
    highscore[name] = {
      count,
      fiveSubmission: count === 5 ? Date.now() : null,
    };
  } else {
    highscore[name].count = count;
    if (count === 5 && highscore[name].fiveSubmission === null) {
      highscore[name].fiveSubmission = Date.now();
    }
  }

  return res.json({
    success: true,
    message: `Rätt flagga! Du har nu submittat ${count} flagg${
      count > 1 ? "or" : "a"
    }.`,
  });
});

/*
 * Endpoint för att hämta Hall of Fame.
 * Returnerar en sorterad array med objekt:
 * { name, count, fiveSubmission }
 * Sortering: först efter count (fallande).
 * Vid lika count och count >= 5 används fiveSubmission (stigande) som tiebreaker.
 */
app.get("/hall-of-fame", (req, res) => {
  const scoresArray = Object.entries(highscore).map(([name, data]) => ({
    name,
    count: data.count,
    fiveSubmission: data.fiveSubmission,
  }));

  scoresArray.sort((a, b) => {
    if (b.count === a.count) {
      // Om båda har löst minst 5 flaggor, använd fiveSubmission som tie-breaker
      if (a.count >= 5 && b.count >= 5) {
        return a.fiveSubmission - b.fiveSubmission;
      }
      return 0; // Ingen ytterligare sortering om de inte nått 5 flaggor
    }
    return b.count - a.count;
  });

  res.json(scoresArray);
});

// Endpoint för att hämta session-info (elevens namn)
app.get("/session-info", (req, res) => {
  res.json({ name: req.session.name || null });
});

// Fallback för alla okända routes
// Bästa http koden?
app.use((req, res, next) => {
  res.status(418).sendFile(path.join(__dirname, "public", "418.html"));
});

app.listen(port, () => {
  console.log(`CTF-servern körs på http://localhost:${port}`);
});
