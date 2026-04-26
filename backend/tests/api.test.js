const request = require('supertest');
const app = require('../server');

describe('ChombieWombie API', () => {
  it('should return 200 and status ok from root', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('should return 400 if no file is uploaded to /api/encode', async () => {
    const res = await request(app).post('/api/encode');
    expect(res.statusCode).toEqual(400);
  });
});
