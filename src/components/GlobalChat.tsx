import React, { useState, useEffect, useRef } from 'react';
import { Send, Camera, Trash2, Edit2, Mic } from 'lucide-react';
import { getFirestore, doc, onSnapshot, collection, addDoc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { db, storage } from './config/firebaseConfig';

const appId = 'default-app-id';
const CLOUDINARY_CLOUD_NAME = 'demhlpk5q';
const CLOUDINARY_UPLOAD_PRESET = 'new_appchat';

interface Message {
  id: string;
  senderId?: string;
  senderName?: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  createdAt?: { seconds: number; toDate: () => Date };
}

interface GlobalChatProps {
  currentUserId: string;
  currentUserName: string;
  onBack: () => void;
  onStartPrivateChat: (userName: string) => void;
}

const GlobalChat = ({ currentUserId, currentUserName, onBack, onStartPrivateChat }: GlobalChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [showCancel, setShowCancel] = useState(false);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordTime, setRecordTime] = useState(0);
  const [showCameraOptions, setShowCameraOptions] = useState(false);
  const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('photo');
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoRecordTime, setVideoRecordTime] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoTimerRef = useRef<NodeJS.Timeout | null>(null);

  const conversationId = 'global';

  // Charger les messages depuis Firebase
  useEffect(() => {
    const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages', conversationId, 'chat');
    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      const messagesList: Message[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      messagesList.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setMessages(messagesList);
      scrollToBottom();
    });
    return () => unsubscribe();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages', conversationId, 'chat');
      await addDoc(messagesRef, {
        senderId: currentUserId,
        senderName: currentUserName,
        text: newMessage,
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCameraClick = () => {
    setShowCameraOptions(!showCameraOptions);
  };

  const handleChooseFromGallery = () => {
    setShowCameraOptions(false);
    fileInputRef.current?.click();
  };

  const handleOpenCamera = async (mode: 'photo' | 'video') => {
    setCameraMode(mode);
    setShowCameraOptions(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }, 
        audio: mode === 'video' 
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Erreur accès caméra:', error);
      alert('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
    }
  };

  const handleCapturePhoto = () => {
    if (canvasRef.current && videoRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob(async (blob) => {
          if (blob) {
            await uploadMediaToCloudinary(blob, true);
            handleCloseCamera();
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  const handleStartVideoRecording = () => {
    if (streamRef.current) {
      videoChunksRef.current = [];
      const recorder = new MediaRecorder(streamRef.current);
      videoRecorderRef.current = recorder;
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          videoChunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = async () => {
        const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        await uploadMediaToCloudinary(videoBlob, false);
        handleCloseCamera();
      };
      
      recorder.start();
      setIsRecordingVideo(true);
      setVideoRecordTime(0);
      videoTimerRef.current = setInterval(() => {
        setVideoRecordTime(t => t + 1);
      }, 1000);
    }
  };

  const handleStopVideoRecording = () => {
    if (videoRecorderRef.current && isRecordingVideo) {
      videoRecorderRef.current.stop();
      setIsRecordingVideo(false);
      if (videoTimerRef.current) {
        clearInterval(videoTimerRef.current);
      }
    }
  };

  const handleCloseCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoTimerRef.current) {
      clearInterval(videoTimerRef.current);
    }
    setCameraActive(false);
    setCameraMode('photo');
    setIsRecordingVideo(false);
    setVideoRecordTime(0);
  };

  const uploadMediaToCloudinary = async (blob: Blob, isImage: boolean) => {
    setUploadingImage(true);
    setUploadProgress(0);
    setShowCancel(false);

    const formData = new FormData();
    formData.append('file', blob);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${isImage ? 'image' : 'video'}/upload`, true);
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        setUploadProgress(progress);
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        const downloadURL = response.secure_url;
        const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages', conversationId, 'chat');
        await addDoc(messagesRef, {
          senderId: currentUserId,
          senderName: currentUserName,
          text: '',
          imageUrl: isImage ? downloadURL : '',
          videoUrl: !isImage ? downloadURL : '',
          createdAt: serverTimestamp()
        });
      } else {
        console.error('Erreur upload Cloudinary:', xhr.responseText);
      }
      setUploadingImage(false);
      setUploadProgress(null);
      setShowCancel(false);
      xhrRef.current = null;
    };

    xhr.onerror = () => {
      setUploadingImage(false);
      setUploadProgress(null);
      setShowCancel(false);
      xhrRef.current = null;
      console.error('Erreur upload Cloudinary');
    };

    xhr.send(formData);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isImage = file.type.startsWith('image/');
      await uploadMediaToCloudinary(file, isImage);
    }
  };

  const handleCancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      setUploadingImage(false);
      setUploadProgress(null);
      setShowCancel(false);
      xhrRef.current = null;
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    const msgRef = doc(db, 'artifacts', appId, 'public', 'data', 'messages', conversationId, 'chat', msgId);
    await deleteDoc(msgRef);
  };

  const handleEditMessage = (msg: Message) => {
    setEditingMsgId(msg.id);
    setEditText(msg.text || '');
  };

  const handleSaveEdit = async (msgId: string) => {
    const msgRef = doc(db, 'artifacts', appId, 'public', 'data', 'messages', conversationId, 'chat', msgId);
    await setDoc(msgRef, { text: editText }, { merge: true });
    setEditingMsgId(null);
    setEditText('');
  };

  const handleCancelEdit = () => {
    setEditingMsgId(null);
    setEditText('');
  };

  const handleStartRecording = async () => {
    if (!navigator.mediaDevices) return;
    setRecording(true);
    setRecordTime(0);
    setAudioChunks([]);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    setMediaRecorder(recorder);
    recorder.ondataavailable = (e) => setAudioChunks((prev) => [...prev, e.data]);
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
    };
    recorder.start();
    recordTimerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
  };

  const handleStopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      setRecording(false);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    }
  };

  const handleSendAudio = async () => {
    if (audioChunks.length === 0) return;
    setUploadingImage(true);
    setUploadProgress(0);
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', audioBlob);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress((event.loaded / event.total) * 100);
      }
    };
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`, true);
    xhr.onload = async () => {
      setUploadingImage(false);
      setUploadProgress(null);
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        const downloadURL = response.secure_url;
        const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages', conversationId, 'chat');
        await addDoc(messagesRef, {
          senderId: currentUserId,
          senderName: currentUserName,
          text: '',
          audioUrl: downloadURL,
          createdAt: serverTimestamp()
        });
        setAudioChunks([]);
        setRecordTime(0);
      }
    };
    xhr.onerror = () => {
      setUploadingImage(false);
      setUploadProgress(null);
    };
    xhr.send(formData);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-white/10 backdrop-blur-lg rounded-2xl p-4 shadow-2xl border border-white/20">
      {cameraActive && (
        <div className="absolute inset-0 bg-black z-50 flex flex-col rounded-2xl overflow-hidden">
          <div className="flex-1 relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            {isRecordingVideo && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 px-4 py-2 rounded-full flex items-center space-x-2">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                <span className="text-white font-bold">{videoRecordTime}s</span>
              </div>
            )}
          </div>
          
          <div className="bg-slate-900 p-4 flex items-center justify-center space-x-4">
            <button
              onClick={handleCloseCamera}
              className="p-4 bg-gray-600 hover:bg-gray-700 rounded-full text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18"/>
                <path d="m6 6 12 12"/>
              </svg>
            </button>
            
            {cameraMode === 'photo' ? (
              <button
                onClick={handleCapturePhoto}
                className="p-6 bg-white hover:bg-gray-200 rounded-full transition-colors shadow-lg"
              >
                <Camera className="w-8 h-8 text-black" />
              </button>
            ) : (
              <button
                onClick={isRecordingVideo ? handleStopVideoRecording : handleStartVideoRecording}
                className={`p-6 rounded-full transition-colors shadow-lg ${
                  isRecordingVideo ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {isRecordingVideo ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="white">
                    <rect width="12" height="12" x="6" y="6" rx="2"/>
                  </svg>
                ) : (
                  <div className="w-8 h-8 bg-white rounded-full" />
                )}
              </button>
            )}
            
            <div className="w-16" />
          </div>
        </div>
      )}

      <div className="flex items-center space-x-2 pb-4 border-b border-white/20">
        <button onClick={onBack} className="md:hidden text-white hover:text-blue-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
          G
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Global Chat</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto my-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
            onMouseEnter={() => setHoveredMsgId(msg.id)}
            onMouseLeave={() => setHoveredMsgId(null)}
          >
            <div className={`p-3 rounded-xl max-w-xs md:max-w-md break-words relative ${msg.senderId === currentUserId ? 'bg-green-600 text-white rounded-br-none' : 'bg-gray-700 text-white rounded-bl-none'}`}>
              <div className="flex items-center mb-1">
                <button
                  onClick={() => {
                    if (msg.senderId !== currentUserId) {
                      onStartPrivateChat(msg.senderName || msg.senderId || '');
                    }
                  }}
                  className={`font-bold text-xs mr-2 ${msg.senderId !== currentUserId ? 'hover:underline hover:text-blue-400 cursor-pointer' : 'cursor-default'}`}
                  disabled={msg.senderId === currentUserId}
                >
                  {msg.senderName || msg.senderId}
                </button>
                <span className="block text-right text-xs text-gray-400">
                  {msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {editingMsgId === msg.id ? (
                <div className="flex flex-col space-y-2">
                  <input type="text" value={editText} onChange={e => setEditText(e.target.value)} className="text-black p-1 rounded" />
                  <div className="flex space-x-2">
                    <button onClick={() => handleSaveEdit(msg.id)} className="px-2 py-1 bg-green-500 text-white rounded text-xs">Sauvegarder</button>
                    <button onClick={handleCancelEdit} className="px-2 py-1 bg-gray-500 text-white rounded text-xs">Annuler</button>
                  </div>
                </div>
              ) : (
                <>
                  {msg.text && <p className="text-sm">{msg.text}</p>}
                  {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="envoyé" className="mt-2 rounded-lg max-w-full max-h-60" />
                  )}
                  {msg.videoUrl && (
                    <video controls className="mt-2 rounded-lg max-w-full max-h-60">
                      <source src={msg.videoUrl} type="video/mp4" />
                      Votre navigateur ne supporte pas la vidéo.
                    </video>
                  )}
                  {msg.audioUrl && (
                    <audio controls className="mt-2 rounded-lg max-w-full">
                      <source src={msg.audioUrl} type="audio/webm" />
                      Votre navigateur ne supporte pas l'audio.
                    </audio>
                  )}
                </>
              )}
              {msg.senderId === currentUserId && hoveredMsgId === msg.id && (
                <div className="absolute top-2 right-2 flex space-x-2">
                  <button onClick={() => handleDeleteMessage(msg.id)} className="bg-red-600 p-1 rounded hover:bg-red-700" title="Supprimer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {msg.text && !msg.imageUrl && !msg.videoUrl && !msg.audioUrl && (
                    <button onClick={() => handleEditMessage(msg)} className="bg-blue-600 p-1 rounded hover:bg-blue-700" title="Modifier">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {uploadingImage && (
        <div className="w-full mb-2" onMouseEnter={() => setShowCancel(true)} onMouseLeave={() => setShowCancel(false)}>
          <div className="h-2 bg-gray-300 rounded-full overflow-hidden relative">
            <div className="h-full bg-green-500 transition-all duration-200" style={{ width: `${uploadProgress ?? 0}%` }} />
            {showCancel && (
              <button onClick={handleCancelUpload} className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-red-600 text-white text-xs rounded shadow hover:bg-red-700 transition-colors duration-200">
                Annuler l'envoi
              </button>
            )}
          </div>
          <div className="text-xs text-white mt-1">Envoi en cours... {Math.round(uploadProgress ?? 0)}%</div>
        </div>
      )}

      <div className="flex items-center space-x-2 mt-2 bg-slate-900/60 rounded-xl p-2 shadow-inner border border-green-600 relative">
        <div className="relative">
          <button 
            type="button" 
            onClick={handleCameraClick} 
            className="p-3 bg-slate-700 rounded-xl text-white shadow-lg hover:bg-slate-600 transition-colors flex-shrink-0"
          >
            <Camera className="w-5 h-5" />
          </button>
          
          {showCameraOptions && (
            <div className="absolute bottom-full mb-2 left-0 flex flex-col space-y-2 bg-slate-800 p-2 rounded-lg shadow-xl border border-white/20">
              <button
                onClick={() => handleOpenCamera('photo')}
                className="p-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
                title="Prendre une photo"
              >
                <Camera className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleOpenCamera('video')}
                className="p-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors"
                title="Enregistrer une vidéo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m22 8-6 4 6 4V8Z"/>
                  <rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>
                </svg>
              </button>
              <button
                onClick={handleChooseFromGallery}
                className="p-3 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors"
                title="Choisir depuis la galerie"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
              </button>
            </div>
          )}
        </div>
        <input type="file" accept="image/*,video/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
        <button
          type="button"
          onClick={recording ? handleStopRecording : handleStartRecording}
          className={`p-3 rounded-xl text-white shadow-lg flex-shrink-0 ${recording ? 'bg-red-600' : 'bg-blue-600'} hover:bg-blue-500 transition-colors duration-200`}
          title={recording ? 'Arrêter' : 'Message vocal'}
          disabled={uploadingImage}
        >
          <Mic className="w-5 h-5" />
        </button>
        <input 
          type="text" 
          value={newMessage} 
          onChange={e => setNewMessage(e.target.value)} 
          onKeyPress={handleKeyPress}
          placeholder="Write a message..." 
          className="flex-1 min-w-0 pl-4 pr-3 py-2 border border-slate-600 rounded-xl bg-slate-800/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" 
          disabled={recording} 
        />
        <button
          type="button"
          onClick={audioChunks.length > 0 && !recording ? handleSendAudio : handleSendMessage}
          className="p-3 bg-green-600 rounded-xl text-white shadow-lg hover:bg-green-500 transition-colors duration-200 border-2 border-green-400 focus:outline-none focus:ring-2 focus:ring-green-400 flex-shrink-0"
          disabled={uploadingImage || (recording || (audioChunks.length === 0 && !newMessage.trim()))}
        >
          <Send className="w-5 h-5" />
        </button>
        {recording && (
          <span className="ml-2 text-red-400 font-bold">{recordTime}s</span>
        )}
      </div>
    </div>
  );
};

export default GlobalChat;