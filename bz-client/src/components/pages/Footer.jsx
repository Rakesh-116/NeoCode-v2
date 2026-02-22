import { FaGithub, FaLinkedin, FaTwitter } from "react-icons/fa";
import { Link } from "react-router-dom";

const Footer = () => {
    return (
        <footer className="w-full bg-black border-t border-white/10">
            <div className="container mx-auto px-6 py-12 max-w-7xl">
                {/* Main Footer Content */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                    {/* Brand Section */}
                    <div className="col-span-1">
                        <div className="flex items-center space-x-2 mb-4">
                            <img src="/logo.png" className="w-8 h-6" alt="NeoCode Logo" />
                            <span className="text-xl font-semibold text-white">NeoCode</span>
                        </div>
                        <p className="text-white/60 text-sm mb-4">
                            AI-powered learning platform transforming how you master coding skills.
                        </p>
                        <div className="flex space-x-4">
                            <a
                                href="https://github.com/Rakesh-116"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white/60 hover:text-white transition-colors duration-300"
                                aria-label="GitHub"
                            >
                                <FaGithub size={20} />
                            </a>
                            <a
                                href="https://www.linkedin.com/in/rakesh-penugonda/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white/60 hover:text-white transition-colors duration-300"
                                aria-label="LinkedIn"
                            >
                                <FaLinkedin size={20} />
                            </a>
                            <a
                                href="https://x.com/rakeshcrafts__"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white/60 hover:text-white transition-colors duration-300"
                                aria-label="X (Twitter)"
                            >
                                <FaTwitter size={20} />
                            </a>
                        </div>
                    </div>

                    {/* Platform Links */}
                    <div>
                        <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Platform</h3>
                        <ul className="space-y-3">
                            <li>
                                <Link
                                    to="/problemset"
                                    className="text-white/60 hover:text-white transition-colors duration-300 text-sm"
                                >
                                    Problems
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/courses"
                                    className="text-white/60 hover:text-white transition-colors duration-300 text-sm"
                                >
                                    Courses
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/compiler"
                                    className="text-white/60 hover:text-white transition-colors duration-300 text-sm"
                                >
                                    Code Compiler
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/learning/profile"
                                    className="text-white/60 hover:text-white transition-colors duration-300 text-sm"
                                >
                                    Learning Dashboard
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div>
                        <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Resources</h3>
                        <ul className="space-y-3">
                            <li>
                                <Link
                                    to="/blogs"
                                    className="text-white/60 hover:text-white transition-colors duration-300 text-sm"
                                >
                                    Blogs
                                </Link>
                            </li>
                            <li>
                                <a
                                    href="#"
                                    className="text-white/60 hover:text-white transition-colors duration-300 text-sm"
                                >
                                    Documentation
                                </a>
                            </li>
                            <li>
                                <a
                                    href="#"
                                    className="text-white/60 hover:text-white transition-colors duration-300 text-sm"
                                >
                                    API Reference
                                </a>
                            </li>
                            <li>
                                <a
                                    href="#"
                                    className="text-white/60 hover:text-white transition-colors duration-300 text-sm"
                                >
                                    Community
                                </a>
                            </li>
                        </ul>
                    </div>

                    {/* Company */}
                    <div>
                        <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Company</h3>
                        <ul className="space-y-3">
                            <li>
                                <a
                                    href="#"
                                    className="text-white/60 hover:text-white transition-colors duration-300 text-sm"
                                >
                                    About
                                </a>
                            </li>
                            <li>
                                <a
                                    href="#"
                                    className="text-white/60 hover:text-white transition-colors duration-300 text-sm"
                                >
                                    Privacy Policy
                                </a>
                            </li>
                            <li>
                                <a
                                    href="#"
                                    className="text-white/60 hover:text-white transition-colors duration-300 text-sm"
                                >
                                    Terms of Service
                                </a>
                            </li>
                            <li>
                                <a
                                    href="#"
                                    className="text-white/60 hover:text-white transition-colors duration-300 text-sm"
                                >
                                    Contact
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="border-t border-white/10 pt-8">
                    <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                        <div className="text-white/60 text-sm">
                            © {new Date().getFullYear()} NeoCode. All rights reserved.
                        </div>
                        <div className="text-white/60 text-sm">
                            Made with <span className="text-red-400">❤️</span> by{" "}
                            <a
                                href="https://www.linkedin.com/in/rakesh-penugonda/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white hover:text-white/80 transition-colors duration-300 font-medium"
                            >
                                Rakesh Penugonda
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
