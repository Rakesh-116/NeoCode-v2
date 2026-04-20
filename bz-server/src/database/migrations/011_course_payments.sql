ALTER TABLE courses
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS price_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_currency VARCHAR(10) DEFAULT 'eur',
ADD COLUMN IF NOT EXISTS access_type VARCHAR(30) DEFAULT 'free';

CREATE TABLE IF NOT EXISTS course_enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'active',
  source VARCHAR(30) DEFAULT 'stripe',
  enrolled_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  stripe_checkout_session_id VARCHAR(255) UNIQUE,
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  stripe_mandate_id VARCHAR(255),
  amount INTEGER NOT NULL,
  currency VARCHAR(10) DEFAULT 'eur',
  payment_method VARCHAR(50) DEFAULT 'sepa_debit',
  status VARCHAR(40) DEFAULT 'created',
  email_sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  provider VARCHAR(50) DEFAULT 'unosend',
  provider_email_id VARCHAR(255),
  email_type VARCHAR(80),
  recipient VARCHAR(255),
  status VARCHAR(40) DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now()
);
