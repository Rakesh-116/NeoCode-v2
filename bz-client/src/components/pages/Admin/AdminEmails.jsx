import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { toast } from "react-toastify";
import Header from "../Header";
import Breadcrumb from "../../Common/Breadcrumb";

const initialForm = {
  userId: "",
  subject: "",
  message: "",
};

const AdminEmails = () => {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const token = Cookies.get("neo_code_jwt_token");
  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

  const selectedUser = useMemo(
    () => users.find((user) => user.id === form.userId),
    [users, form.userId]
  );

  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      setError("");

      try {
        const response = await axios.get(`${API_BASE_URL}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setUsers(Array.isArray(response.data.response) ? response.data.response : []);
      } catch (err) {
        console.error(err);
        setError("Failed to load users.");
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [API_BASE_URL, token]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.userId || !form.subject.trim() || !form.message.trim()) {
      toast.error("Choose a user, subject, and message.");
      return;
    }

    setSending(true);
    setError("");

    try {
      await axios.post(
        `${API_BASE_URL}/api/admin/emails/send`,
        {
          userId: form.userId,
          subject: form.subject.trim(),
          message: form.message.trim(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success("Email sent.");
      setForm(initialForm);
    } catch (err) {
      const message = err.response?.data?.message || "Failed to send email.";
      setError(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-black/95 min-h-screen text-white">
      <Header />
      <main className="pt-28 px-10 pb-16">
        <Breadcrumb
          items={[
            { label: "Admin Dashboard", href: "/admin" },
            { label: "Email Tool" },
          ]}
        />

        <div className="max-w-5xl">
          <h1 className="text-4xl font-semibold mb-3">Send Email</h1>
          <p className="text-white/70 mb-8">
            Send a manual message to a registered user through Unosend.
          </p>

          <form
            onSubmit={handleSubmit}
            className="border border-white/15 bg-white/5 rounded-lg p-6 space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
              <div className="space-y-5">
                <label className="block">
                  <span className="block text-sm text-white/70 mb-2">Recipient</span>
                  <select
                    value={form.userId}
                    onChange={(event) => updateField("userId", event.target.value)}
                    disabled={loadingUsers || sending}
                    className="w-full bg-black/80 border border-white/20 rounded-md px-4 py-3 text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  >
                    <option value="">
                      {loadingUsers ? "Loading users..." : "Choose a user"}
                    </option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.username} - {user.email}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-sm text-white/70 mb-2">Subject</span>
                  <input
                    value={form.subject}
                    onChange={(event) => updateField("subject", event.target.value)}
                    maxLength={160}
                    disabled={sending}
                    placeholder="Course update, payment note, welcome message..."
                    className="w-full bg-black/80 border border-white/20 rounded-md px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                  <span className="block text-xs text-white/40 mt-2">
                    {form.subject.length}/160
                  </span>
                </label>

                <label className="block">
                  <span className="block text-sm text-white/70 mb-2">Message</span>
                  <textarea
                    value={form.message}
                    onChange={(event) => updateField("message", event.target.value)}
                    disabled={sending}
                    rows={10}
                    placeholder="Write the message users should receive..."
                    className="w-full bg-black/80 border border-white/20 rounded-md px-4 py-3 text-white placeholder:text-white/35 resize-y focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                </label>
              </div>

              <aside className="border border-white/10 bg-black/40 rounded-lg p-4 h-fit">
                <h2 className="font-semibold mb-4">Recipient Preview</h2>
                {selectedUser ? (
                  <div className="space-y-3 text-sm">
                    <p className="text-white/60">Name</p>
                    <p>{selectedUser.username}</p>
                    <p className="text-white/60 pt-2">Email</p>
                    <p className="break-words">{selectedUser.email}</p>
                    <p className="text-white/60 pt-2">Role</p>
                    <p className="capitalize">{selectedUser.role}</p>
                  </div>
                ) : (
                  <p className="text-white/50 text-sm">Choose a user to preview the recipient.</p>
                )}
              </aside>
            </div>

            {error && (
              <div className="border border-red-500/40 bg-red-500/10 text-red-200 rounded-md px-4 py-3">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setForm(initialForm)}
                disabled={sending}
                className="px-5 py-2.5 border border-white/20 rounded-md text-white/80 hover:bg-white/10 disabled:opacity-60"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={sending || loadingUsers}
                className="px-5 py-2.5 bg-blue-600 rounded-md text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {sending ? "Sending..." : "Send Email"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default AdminEmails;
