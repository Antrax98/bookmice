//Se ejecuta antes de que Jest cargue los modulos del test, y por tanto antes
//que ConfigModule. dotenv no pisa lo que ya esta en process.env, asi que esta
//linea gana sobre el .env sin tener que tocarlo.
process.env.DB_NAME = process.env.E2E_DB_NAME ?? 'monolith_test';
