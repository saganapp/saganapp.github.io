import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n";

interface FallbackProps {
  compact: boolean;
  onReset: () => void;
}

function ErrorFallback({ compact, onReset }: FallbackProps) {
  const { t } = useLocale();

  if (compact) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {t("error.sectionFailed")}
          </p>
          <button
            className="mt-1 text-xs text-primary hover:underline"
            onClick={onReset}
          >
            {t("error.tryAgain")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-xl font-semibold">{t("error.somethingWrong")}</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {t("error.unexpectedError")}
      </p>
      <Button
        variant="outline"
        onClick={() => {
          onReset();
          window.location.reload();
        }}
      >
        {t("error.reload")}
      </Button>
    </div>
  );
}

interface Props {
  children: ReactNode;
  compact?: boolean;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          compact={!!this.props.compact}
          onReset={() => this.setState({ hasError: false })}
        />
      );
    }

    return this.props.children;
  }
}
