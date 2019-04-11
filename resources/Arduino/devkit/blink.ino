// the setup function runs once when you press reset or power the board
void setup() {
  // initialize digital pin LED_USER as an output.
  pinMode(LED_USER, OUTPUT);
}

// the loop function runs over and over again forever
void loop() {
  digitalWrite(LED_USER, HIGH);   // turn the LED on 
  delay(1000);                       // wait for a second
  digitalWrite(LED_USER, LOW);    // turn the LED off 
  delay(1000);                       // wait for a second
}