import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'bz-server', '.env') });

const get = (name, fallback) => process.env[name] ?? fallback;

const config = {
  PYTHON_CONTAINER_NAME: get('PYTHON_CONTAINER_NAME', 'python-container'),
  JAVA_CONTAINER_NAME: get('JAVA_CONTAINER_NAME', 'java-container'),
  CPP_CONTAINER_NAME: get('CPP_CONTAINER_NAME', 'cpp-container'),
  // worker directories (relative to this file's parent 'src')
  WORKERS_DIR: get('WORKERS_DIR', 'src/workers'),
};

export default config;
