import { Link } from "react-router-dom";
import Header from "./Header.jsx";

const PaymentCancel = () => {
    return (
        <div className="bg-black/95 min-h-screen">
            <Header />
            <main className="pt-28 px-6 max-w-3xl mx-auto">
                <div className="border border-white/10 bg-white/5 rounded-lg p-8">
                    <p className="text-yellow-300 text-sm font-medium mb-3">Checkout cancelled</p>
                    <h1 className="text-3xl font-bold text-white mb-3">No payment was completed</h1>
                    <p className="text-white/70 mb-6">
                        You can return to courses and start checkout again whenever you are ready.
                    </p>
                    <Link
                        to="/courses"
                        className="inline-flex px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        Back to Courses
                    </Link>
                </div>
            </main>
        </div>
    );
};

export default PaymentCancel;
