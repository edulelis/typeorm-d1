const { createD1DataSource } = require('./dist/createD1DataSource.js');
const db = {
  prepare: () => ({
    bind: () => ({
      all: async () => ({ results: [] }),
      run: async () => ({ meta: { changes: 1, last_row_id: 1 } })
    })
  }),
  batch: async () => []
};

const ds = createD1DataSource({
  database: db,
  entities: [],
  synchronize: false
});

ds.initialize().then(() => {
  const qr = ds.createQueryRunner();
  console.log('QR.connection === ds:', qr.connection === ds);
  console.log('QR.connection.manager:', !!qr.connection?.manager);
  console.log('QR.connection.manager.broadcaster:', !!qr.connection?.manager?.broadcaster);
  console.log('Broadcaster type:', typeof qr.connection?.manager?.broadcaster);
  if (qr.connection?.manager?.broadcaster) {
    console.log('Has broadcastBeforeInsertEvent:', typeof qr.connection.manager.broadcaster.broadcastBeforeInsertEvent);
  }
  qr.release();
  ds.destroy();
}).catch(e => {
  console.error('Error:', e.message);
  console.error(e.stack);
  process.exit(1);
});
