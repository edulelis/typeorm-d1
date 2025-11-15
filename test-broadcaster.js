const { DataSource } = require('typeorm');
const db = {
  prepare: () => ({
    bind: () => ({
      all: async () => ({ results: [] }),
      run: async () => ({ meta: {} })
    })
  }),
  batch: async () => {}
};

// Simulate createD1DataSource
const originalCreate = require('typeorm/driver/DriverFactory').DriverFactory.prototype.create;
require('typeorm/driver/DriverFactory').DriverFactory.prototype.create = function(connection) {
  const driverOptions = connection.options?.driver;
  if (driverOptions?.database && typeof driverOptions.database.prepare === 'function') {
    const { D1Driver } = require('./dist/D1Driver.js');
    return new D1Driver(connection);
  }
  return originalCreate.call(this, connection);
};

const ds = new DataSource({
  type: 'sqlite',
  database: ':memory:',
  entities: [],
  synchronize: false,
  driver: { database: db }
});

ds.initialize().then(() => {
  console.log('Initialized:', ds.isInitialized);
  console.log('Manager:', !!ds.manager);
  console.log('Manager.broadcaster:', !!ds.manager?.broadcaster);
  console.log('Broadcaster type:', typeof ds.manager?.broadcaster);
  if (ds.manager?.broadcaster) {
    console.log('Broadcaster methods:', Object.keys(ds.manager.broadcaster).slice(0, 10));
  }
  ds.destroy();
}).catch(e => {
  console.error('Error:', e.message);
  console.error(e.stack);
  process.exit(1);
});
