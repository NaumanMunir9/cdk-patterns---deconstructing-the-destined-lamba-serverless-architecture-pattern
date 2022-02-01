export async function handler(event: any) {
  console.log(`Event Received: ${JSON.stringify(event)}`);

  let records: any[] = event.Records;

  // SNS can send multiple records
  for (let record of records) {
    let message = records[record].Sns.Message;
    if (message == "please fail") {
      console.log(`Failing the lambda`);
      throw new Error("Failed to send message");
    }
  }

  return {
    source: "the-destined-lambda",
    action: "message",
    message: "Hey There!",
  };
}
