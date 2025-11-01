import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Mic, MicOff, Camera, Type, Sparkles } from "lucide-react";
import { InputMode, AppStatus, AnalysisResult } from "@/types/emotion";
import { EmotionResult } from "@/components/EmotionResult";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// @ts-ignore - SpeechRecognition types
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechRecognitionSupported = !!SpeechRecognition;

const Index = () => {
  const [inputMode, setInputMode] = useState<InputMode>(InputMode.TEXT);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [textInput, setTextInput] = useState<string>("");
  const [voiceTranscript, setVoiceTranscript] = useState<string>("");
  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  
  const { toast } = useToast();
  const recognitionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  const analyzeEmotion = async (mode: InputMode, input: string) => {
    setStatus(AppStatus.ANALYZING);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-emotion', {
        body: { mode, input }
      });

      if (error) throw error;

      setResult(data);
      setStatus(AppStatus.SUCCESS);
    } catch (error: any) {
      console.error('Analysis error:', error);
      setStatus(AppStatus.ERROR);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze emotion. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleTextAnalysis = () => {
    if (!textInput.trim()) {
      toast({
        title: "Empty Input",
        description: "Please enter some text to analyze.",
        variant: "destructive"
      });
      return;
    }
    analyzeEmotion(InputMode.TEXT, textInput);
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          setVoiceTranscript("Analyzing audio...");
          await analyzeEmotion(InputMode.VOICE, base64Audio);
        };
        
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setStatus(AppStatus.LISTENING);
      setVoiceTranscript("");
    } catch (error) {
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access to use this feature.",
        variant: "destructive"
      });
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setStatus(AppStatus.IDLE);
    }
  };

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      setIsWebcamActive(true);
    } catch (error) {
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to use this feature.",
        variant: "destructive"
      });
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsWebcamActive(false);
  };

  const captureAndAnalyze = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg');
    analyzeEmotion(InputMode.WEBCAM, imageData);
  };

  const renderModeContent = () => {
    switch (inputMode) {
      case InputMode.TEXT:
        return (
          <div className="space-y-4">
            <Textarea
              placeholder="Type or paste your text here..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="min-h-[200px] text-lg resize-none"
            />
            <Button
              onClick={handleTextAnalysis}
              disabled={status === AppStatus.ANALYZING}
              className="w-full h-12 text-lg bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
            >
              {status === AppStatus.ANALYZING ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Analyze Emotion
                </>
              )}
            </Button>
          </div>
        );

      case InputMode.VOICE:
        return (
          <div className="space-y-6 text-center">
            <div className="py-12">
              <div className={`mx-auto w-32 h-32 rounded-full flex items-center justify-center ${
                status === AppStatus.LISTENING 
                  ? 'bg-gradient-to-br from-red-500 to-red-600 animate-pulse' 
                  : 'bg-gradient-to-br from-primary to-secondary'
              }`}>
                {status === AppStatus.LISTENING ? (
                  <MicOff className="h-16 w-16 text-white" />
                ) : (
                  <Mic className="h-16 w-16 text-white" />
                )}
              </div>
              {voiceTranscript && (
                <p className="mt-6 text-lg text-muted-foreground italic">
                  "{voiceTranscript}"
                </p>
              )}
            </div>
            <Button
              onClick={status === AppStatus.LISTENING ? stopVoiceRecording : startVoiceRecording}
              disabled={status === AppStatus.ANALYZING || !isSpeechRecognitionSupported}
              className="w-full h-12 text-lg bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
            >
              {status === AppStatus.LISTENING ? "Stop Recording" : "Start Recording"}
            </Button>
          </div>
        );

      case InputMode.WEBCAM:
        return (
          <div className="space-y-4">
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />
              {!isWebcamActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Camera className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {!isWebcamActive ? (
                <Button
                  onClick={startWebcam}
                  className="flex-1 h-12 text-lg bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Start Camera
                </Button>
              ) : (
                <>
                  <Button
                    onClick={captureAndAnalyze}
                    disabled={status === AppStatus.ANALYZING}
                    className="flex-1 h-12 text-lg bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
                  >
                    {status === AppStatus.ANALYZING ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Capture & Analyze
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={stopWebcam}
                    variant="outline"
                    className="px-6 h-12"
                  >
                    Stop
                  </Button>
                </>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12 animate-in fade-in slide-in-from-top duration-500">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Emotion Analyzer
          </h1>
          <p className="text-xl text-muted-foreground">
            Discover emotions through text, voice, or facial expressions
          </p>
        </div>

        <Card className="p-6 mb-8 shadow-xl border-2 animate-in fade-in slide-in-from-bottom duration-500">
          <div className="flex gap-2 mb-6">
            <Button
              variant={inputMode === InputMode.TEXT ? "default" : "outline"}
              onClick={() => {
                setInputMode(InputMode.TEXT);
                setResult(null);
                stopWebcam();
              }}
              className="flex-1 h-12"
            >
              <Type className="mr-2 h-5 w-5" />
              Text
            </Button>
            <Button
              variant={inputMode === InputMode.VOICE ? "default" : "outline"}
              onClick={() => {
                setInputMode(InputMode.VOICE);
                setResult(null);
                stopWebcam();
              }}
              className="flex-1 h-12"
              disabled={!isSpeechRecognitionSupported}
            >
              <Mic className="mr-2 h-5 w-5" />
              Voice
            </Button>
            <Button
              variant={inputMode === InputMode.WEBCAM ? "default" : "outline"}
              onClick={() => {
                setInputMode(InputMode.WEBCAM);
                setResult(null);
              }}
              className="flex-1 h-12"
            >
              <Camera className="mr-2 h-5 w-5" />
              Webcam
            </Button>
          </div>

          {renderModeContent()}
        </Card>

        {result && <EmotionResult result={result} />}
      </div>
    </div>
  );
};

export default Index;
