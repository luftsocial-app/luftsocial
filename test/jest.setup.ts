import { DatabaseHelper } from './helpers/database.helper';

beforeAll(async () => {
  await DatabaseHelper.startContainer();
  // Wait for container to be ready
  await new Promise((resolve) => setTimeout(resolve, 2000));
}, 60000); // Increase timeout for container startup

afterEach(async () => {
  await DatabaseHelper.cleanDatabase();
});

afterAll(async () => {
  await DatabaseHelper.stopContainer();
});
