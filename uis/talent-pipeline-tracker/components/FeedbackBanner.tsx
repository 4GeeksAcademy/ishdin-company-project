interface FeedbackBannerProps {
  message: string;
  tone?: "success" | "error";
}

const FeedbackBanner = ({
  message,
  tone = "success",
}: FeedbackBannerProps) => {
  if (!message) return null;

  return (
    <div className={`feedback ${tone}`} role={tone === "error" ? "alert" : "status"}>
      {message}
    </div>
  );
};

export default FeedbackBanner;
