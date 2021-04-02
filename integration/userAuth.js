
const mocha = require('mocha');
var fs = require('fs');
const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);
const should = chai.should();
const expect = chai.expect;
const { request } = require('chai');

const endpoints = {
  authSignIn: '/api/auth/sign-in',
  authRegister: '/api/auth/register',
  authGuarded: '/api/auth/guarded',
}

const newUserAdmin = {
  username: "new_username_admin",
  password: "new_password_admin",
  role: "ADMIN"
}

const newUserNormal = {
  username: "new_username_user",
  password: "new_password_user",
  role: "USER"
}

const path = require("path");
const { Pool } = require('pg')
const { DockerComposeEnvironment } = require("testcontainers");

describe("Docker Compose Environment", () => {
  let environment;
  let postgreDb;
  let monolith = {};
  before(async () => {
    const composeFilePath = path.resolve(__dirname, "../");
    const composeFile = "docker-compose.yml";
    console.log(composeFilePath);
    environment = await new DockerComposeEnvironment(composeFilePath, composeFile).withBuild().up();

    const postgreContainer = environment.getContainer("postgres_1");
    postgreDb = new Pool({
      user: "sandbox",
      host: postgreContainer.getHost(),
      database: "sandbox",
      password: "sandbox",
      port: postgreContainer.getMappedPort(5432),
    })

    const monolithContainer = environment.getContainer('monolith_1');

    monolith.host = monolithContainer.getHost();
    monolith.port = monolithContainer.getMappedPort(3000);


  });

  it("db connected", async () => {
    await postgreDb.query('SELECT NOW()');
  });


  it("schema created successfully", async () => {
    let schemaPath = path.resolve(__dirname, "../src/module/users/schema.sql");
    var sql = fs.readFileSync(schemaPath).toString();
    await postgreDb.query(sql);
  })


  describe('Docker Compose Environment Register', () => {
    describe('POST /register', () => {
      it('register new admin should return status code of 201 and status of success', async () => {
        const url = `${monolith.host}:${monolith.port}`;
        const res = await chai.request(url)
          .post(endpoints.authRegister)
          .send(newUserAdmin)

        res.should.have.status(201);
        expect(res.body).to.contain({
          status: "SUCCESS",
        });

      });

      it('register existing admin should return status code of 500 ', async () => {
        const url = `${monolith.host}:${monolith.port}`;
        const res = await chai.request(url)
          .post(endpoints.authRegister)
          .send(newUserAdmin)

        res.should.have.status(500);
      });

      it('register new normal user should return status code of 201 and status of success', async () => {
        const url = `${monolith.host}:${monolith.port}`;
        const res = await chai.request(url)
          .post(endpoints.authRegister)
          .send(newUserNormal)

        res.should.have.status(201);
        expect(res.body).to.contain({
          status: "SUCCESS",
        });

      });

    });
  })



  describe('Docker Compose Environment Authentication', () => {
    describe('POST /sign-in', () => {
      it('if bad credentials should return code 200 with status error', async () => {
        const url = `${monolith.host}:${monolith.port}`;
        const res = await chai.request(url)
          .post(endpoints.authSignIn)
          .send({
            username: "fake_username",
            password: "fake_password"
          })

        res.should.have.status(200);
        expect(res.body).to.contain({
          status: "ERROR",
        });

      });

      it('if good credentials should return code 200 with status SUCCESS', async () => {
        const url = `${monolith.host}:${monolith.port}`;
        const res = await chai.request(url)
          .post(endpoints.authSignIn)
          .send(newUserAdmin)

        res.should.have.status(200);
        expect(res.body).to.contain({
          status: "SUCCESS",
        });

      });
    });

  })

  describe('Docker Compose Environment Logged in endpoints', () => {
    const badToken = 'rekjkrejvirvblrvrnrivnr'
    let goodAdminToken;
    let goodNormalToken;
    before(async () => {
      const url = `${monolith.host}:${monolith.port}`;
      const resAdmin = await chai.request(url)
        .post(endpoints.authSignIn)
        .send(newUserAdmin)

      resAdmin.should.have.status(200);

      goodAdminToken = resAdmin.body.data;

      const resNormal = await chai.request(url)
        .post(endpoints.authSignIn)
        .send(newUserNormal)

      resNormal.should.have.status(200);

      goodNormalToken = resNormal.body.data;

    })
    describe('GET /guarded', () => {
      it('if no token is provided should return a 401 status code ', async () => {
        const url = `${monolith.host}:${monolith.port}`;
        const res = await chai.request(url)
          .get(endpoints.authGuarded)

        res.should.have.status(401);

      });

      it('if a bad  token is provided should return a 401 status code ', async () => {
        const url = `${monolith.host}:${monolith.port}`;
        const res = await chai.request(url)
          .get(endpoints.authGuarded)
          .set("Authorization", badToken)

        res.should.have.status(401);

      });

      it('if a normal user token  is provided should return a 401 status code ', async () => {
        const url = `${monolith.host}:${monolith.port}`;
        const res = await chai.request(url)
          .get(endpoints.authGuarded)
          .set("Authorization", goodNormalToken)

        res.should.have.status(401);

      });

      it('if a admin user token  is provided should return a 200 status code ', async () => {
        const url = `${monolith.host}:${monolith.port}`;
        const res = await chai.request(url)
          .get(endpoints.authGuarded)
          .set("Authorization", goodAdminToken)

        res.should.have.status(200);

      });
    })
  })

  after(async () => {
    await postgreDb.end();
    await environment.down();

  });

});