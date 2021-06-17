const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const InitializeDBandServer = async (request, response) => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is starting...");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

InitializeDBandServer();

app.post("/register/", async (request, response) => {
  const userDetails = request.body;
  const { username, name, password, gender, location } = userDetails;
  const getUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
  `;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const addUserQuery = `
    INSERT INTO user(username, name, password, gender, location)
    VALUES(
        '${username}',
        '${name}',
        '${hashedPassword}',
        '${gender}',
        '${location}'
    );
  `;
    const dbResponse = await db.run(addUserQuery);
    response.send("New User Created");
  } else {
    response.status(400);
    response.send("Invalid username");
  }
});

// user login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
  `;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordTrue = await bcrypt.compare(password, dbUser.password);
    if (isPasswordTrue) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "hello");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader != undefined) {
    jwtToken = authHeader.split()[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "hello", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//get states details

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesDetailsQuery = `
        SELECT state_id as stateId,
                state_name as stateName,
                population
                FROM state;
    `;
  const states = db.all(getStatesDetailsQuery);
  response.send(states);
});

// get state details

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateDetailsQuery = `
        SELECT state_id as stateId,
                state_name as stateName,
                population
                FROM state
                WHERE state_id = ${stateId};
    `;
  const states = db.get(getStateDetailsQuery);
  response.send(states);
});

// add district

app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
        INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
        VALUES(
            '${districtName}'
            ${stateId},
            ${cases},
            ${cured},
            ${active},
            ${deaths}
        );
    `;
  const dbResponse = db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictDetailsQuery = `
        SELECT district_id as districtId,
                district_name as districtName,
                state_id as stateId,
                cases,
                cured,
                active,
                deaths
                FROM district
                WHERE district_id = ${districtId}'
    `;
    const district = await db.get(getDistrictDetailsQuery);
    response.send(district);
  }
);

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
        DELETE FROM district WHERE district_id = ${districtId};
    `;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const { districtId } = request.params;
    const updateDistrictQuery = `
        UPDATE district SET district_name = '${districtName}'
                            state_id = ${stateId},
                            cases = ${cases},
                            cured = ${cured},
                            active = ${active},
                            deaths = ${deaths}
                        WHERE district_id = ${districtId};
    `;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `
        SELECT sum(cases) as totalCases,
                sum(cured) as totalCured,
                sum(active) as totalActive,
                sum(deaths) as totalDeaths
            FROM district WHERE state_id = ${stateId};
    `;
    const stats = db.get(getStatsQuery);
    response.send(stats);
  }
);

module.exports = app;
