import { Card } from "@/components/ui/card";
import { AnalysisResult } from "@/types/emotion";

interface EmotionResultProps {
  result: AnalysisResult;
}

export const EmotionResult = ({ result }: EmotionResultProps) => {
  const getColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      'yellow': 'from-yellow-400 to-yellow-500',
      'blue': 'from-blue-400 to-blue-500',
      'red': 'from-red-400 to-red-500',
      'purple': 'from-purple-400 to-purple-500',
      'green': 'from-green-400 to-green-500',
      'gray': 'from-gray-400 to-gray-500',
      'pink': 'from-pink-400 to-pink-500',
    };
    
    const baseColor = color.split('-')[0];
    return colorMap[baseColor] || 'from-primary to-secondary';
  };

  return (
    <Card className="p-8 bg-gradient-to-br from-card to-muted border-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-6">
        <div className={`text-8xl mb-4 bg-gradient-to-br ${getColorClass(result.color)} bg-clip-text text-transparent`}>
          {result.emoji}
        </div>
        
        <div>
          <h3 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            {result.emotion}
          </h3>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-2 w-48 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${getColorClass(result.color)} transition-all duration-1000`}
                style={{ width: `${result.confidence * 100}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-muted-foreground">
              {(result.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
          {result.explanation}
        </p>
      </div>
    </Card>
  );
};
