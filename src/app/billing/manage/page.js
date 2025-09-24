import ClientManage from './ClientManage.jsx';

export const dynamicParams = true;
export const revalidate = 0;

export default function ManagePage() {
  return (
    <main style={{ padding: 24, display:'flex', justifyContent:'center' }}>
      <div style={{ width: '100%', maxWidth: 960 }}>
        <ClientManage />
      </div>
    </main>
  );
}
