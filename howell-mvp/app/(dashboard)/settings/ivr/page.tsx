'use client'
import { useState } from 'react'
import {
  Phone, CheckCircle, AlertCircle, Copy, ExternalLink,
  Settings, Mic, List, Play, Zap, Info
} from 'lucide-react'

const STEPS = [
  {
    step: '1',
    title: 'Create a Twilio Account',
    desc: 'Sign up at twilio.com/try-twilio. Free trial includes $15 credit — enough for ~1,000 IVR minutes.',
    action: { label: 'Open Twilio', href: 'https://www.twilio.com/try-twilio' },
  },
  {
    step: '2',
    title: 'Get a Phone Number',
    desc: 'In Twilio Console → Phone Numbers → Buy a Number. Select a number with Voice capability.',
    action: { label: 'Twilio Console', href: 'https://console.twilio.com/us1/develop/phone-numbers/manage/incoming' },
  },
  {
    step: '3',
    title: 'Add credentials to environment',
    desc: 'Go to Vercel → Project → Settings → Environment Variables and add these three variables:',
    env: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
    action: { label: 'Vercel Dashboard', href: 'https://vercel.com/dashboard' },
  },
  {
    step: '4',
    title: 'Point your Twilio number to this webhook',
    desc: 'In Twilio Console → Your Phone Number → Configure → Voice webhook URL:',
    webhookPath: '/api/ivr/voice',
    action: { label: 'Twilio Phone Numbers', href: 'https://console.twilio.com/us1/develop/phone-numbers/manage/incoming' },
  },
]

const IVR_FLOW = [
  { icon: Phone,   label: 'Candidate calls Twilio number',        color: 'bg-blue-100 text-blue-700' },
  { icon: Mic,     label: 'IVR greets and reads Q1 aloud (TTS)',  color: 'bg-purple-100 text-purple-700' },
  { icon: Mic,     label: 'Candidate speaks answer (recorded)',    color: 'bg-red-100 text-red-700' },
  { icon: List,    label: 'Repeats for all role-specific questions', color: 'bg-yellow-100 text-yellow-700' },
  { icon: Zap,     label: 'AI transcribes & scores responses',    color: 'bg-green-100 text-green-700' },
  { icon: CheckCircle, label: 'Results appear in Pre-Screen page', color: 'bg-emerald-100 text-emerald-700' },
]

export default function IVRSettingsPage() {
  const [copied, setCopied] = useState<string | null>(null)
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://howell-hr.vercel.app'

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Phone size={20} className="text-blue-700"/>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">IVR Voice Bot</h1>
            <p className="text-sm text-gray-500">Stage 04 — Automated pre-screening via phone call (Twilio)</p>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3.5 mt-4">
          <Info size={15} className="text-blue-600 flex-shrink-0 mt-0.5"/>
          <p className="text-sm text-blue-700">
            The IVR webhook is <strong>fully built and deployed</strong> at <code className="bg-blue-100 px-1 rounded">/api/ivr/voice</code>.
            Connect Twilio credentials in Vercel and candidates can call in for automated pre-screen interviews.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">How It Works</h2>
        <div className="space-y-2">
          {IVR_FLOW.map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full ${f.color} flex items-center justify-center flex-shrink-0`}>
                <f.icon size={13}/>
              </div>
              <span className="text-sm text-gray-700">{f.label}</span>
              {i < IVR_FLOW.length - 1 && (
                <div className="ml-3.5 border-l border-dashed border-gray-200 h-4 absolute" style={{ transform: 'translateX(-1px)', marginLeft: '13px' }}/>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Setup steps */}
      <div className="space-y-4 mb-6">
        <h2 className="font-semibold text-gray-900">Setup Guide</h2>
        {STEPS.map((s) => (
          <div key={s.step} className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-red-700 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                {s.step}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{s.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{s.desc}</p>

                {s.env && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-1.5">
                    {s.env.map(env => (
                      <div key={env} className="flex items-center gap-2">
                        <code className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded flex-1">{env}</code>
                        <button onClick={() => copy(env, env)}
                          className="text-gray-400 hover:text-gray-600 transition">
                          {copied === env ? <CheckCircle size={13} className="text-green-500"/> : <Copy size={13}/>}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {s.webhookPath && (
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3 mb-3">
                    <code className="text-xs text-gray-700 flex-1 break-all">{appUrl}{s.webhookPath}</code>
                    <button onClick={() => copy(`${appUrl}${s.webhookPath}`, 'webhook')}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition">
                      {copied === 'webhook' ? <CheckCircle size={13} className="text-green-500"/> : <Copy size={13}/>}
                    </button>
                  </div>
                )}

                {s.action && (
                  <a href={s.action.href} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-red-700 hover:text-red-800 font-medium border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition">
                    <ExternalLink size={13}/> {s.action.label}
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Webhook endpoint detail */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Webhook Endpoints</h2>
        <div className="space-y-3">
          {[
            { method: 'POST', path: '/api/ivr/voice', desc: 'Entry point — greets caller, reads first question' },
            { method: 'POST', path: '/api/ivr/record', desc: 'Handles recording callbacks, reads next question or ends call' },
            { method: 'GET',  path: '/api/ivr/status', desc: 'Returns IVR session status (for polling from dashboard)' },
          ].map(ep => (
            <div key={ep.path} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
              <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${ep.method === 'POST' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {ep.method}
              </span>
              <div className="flex-1">
                <code className="text-xs text-gray-700">{appUrl}{ep.path}</code>
                <p className="text-xs text-gray-500 mt-0.5">{ep.desc}</p>
              </div>
              <button onClick={() => copy(`${appUrl}${ep.path}`, ep.path)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition">
                {copied === ep.path ? <CheckCircle size={13} className="text-green-500"/> : <Copy size={13}/>}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
