import { Link, useSearchParams } from "react-router-dom";
import Header from "./Header.jsx";

const PaymentSuccess = () => {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get("session_id");

    return (
        <div className="bg-black/95 min-h-screen">
            <Header />
            <main className="pt-28 px-6 max-w-3xl mx-auto">
                <div className="border border-white/10 bg-white/5 rounded-lg p-8">
                    <p className="text-emerald-300 text-sm font-medium mb-3">Payment received</p>
                    <h1 className="text-3xl font-bold text-white mb-3">Your course is being unlocked</h1>
                    <p className="text-white/70 mb-6">
                        Stripe has received your SEPA payment. As soon as the webhook confirms the payment, NeoCode
                        unlocks the course and sends your Unosend receipt email.
                    </p>
                    {sessionId && (
                        <p className="text-white/40 text-xs mb-6 break-all">Checkout session: {sessionId}</p>
                    )}
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

export default PaymentSuccess;
