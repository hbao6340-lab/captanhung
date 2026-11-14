import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f3f4f6] py-12 px-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <span>🔍</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Event not found</h2>
        <p className="text-gray-600 mb-6">The event you&rsquo;re looking for doesn&rsquo;t exist or is not public.</p>
        <a href="/" className="text-indigo-600 hover:underline text-sm">Browse events</a>
      </div>
    </div>
  );
}
