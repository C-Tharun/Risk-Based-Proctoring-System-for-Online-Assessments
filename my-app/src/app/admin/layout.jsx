export default function AdminLayout({ children }) {
  return (
    <div>
      <main className="p-6">{children}</main>
    </div>
  );
}