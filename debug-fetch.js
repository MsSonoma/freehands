import('node-fetch').then(async ({default:fetch}) => {
  try {
    const res = await fetch('http://localhost:3000/');
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Body snippet:', text.slice(0,200));
  } catch (e) {
    console.error('Fetch error:', e);
  }
});