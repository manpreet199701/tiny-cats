/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI} from '@google/genai';
import {marked} from 'marked';

const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

const userInput = document.querySelector('#input') as HTMLTextAreaElement;
const modelOutput = document.querySelector('#output') as HTMLDivElement;
const slideshow = document.querySelector('#slideshow') as HTMLDivElement;
const error = document.querySelector('#error') as HTMLDivElement;

async function addSlide(text: string, image: HTMLImageElement) {
  const slide = document.createElement('div');
  slide.className = 'slide';
  const caption = document.createElement('div') as HTMLDivElement;
  caption.innerHTML = await marked.parse(text);
  slide.append(image);
  slide.append(caption);
  slideshow.append(slide);
}

async function generate(message: string) {
  userInput.disabled = true;
  modelOutput.innerHTML = '';
  slideshow.innerHTML = '';
  error.innerHTML = '';
  error.toggleAttribute('hidden', true);

  try {
    const userTurn = document.createElement('div') as HTMLDivElement;
    userTurn.innerHTML = await marked.parse(message);
    userTurn.className = 'user-turn';
    modelOutput.append(userTurn);
    userInput.value = '';

    const storyPlanPrompt = `You are a storyteller. Explain the following topic using a fun story about lots of tiny cats as a metaphor: "${message}".

Break the story into short, conversational, and engaging sentences. For each sentence, create a prompt for an image generator to create a cute, minimal illustration with black ink on a white background.

Respond with a JSON array of objects, where each object has a "sentence" and an "image_prompt" property. Only output the JSON.`;

    const storyResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: storyPlanPrompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let jsonStr = storyResponse.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    const storyPlan = JSON.parse(jsonStr);

    if (!Array.isArray(storyPlan) || storyPlan.length === 0) {
      throw new Error('Could not generate a story. Please try another topic.');
    }

    slideshow.removeAttribute('hidden');

    for (const part of storyPlan) {
      if (part.sentence && part.image_prompt) {
        const imageResponse = await ai.models.generateImages({
          model: 'imagen-3.0-generate-002',
          prompt: part.image_prompt,
          config: {numberOfImages: 1, outputMimeType: 'image/jpeg'},
        });

        const base64ImageBytes =
          imageResponse.generatedImages[0].image.imageBytes;
        const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
        const img = document.createElement('img');
        img.src = imageUrl;

        await addSlide(part.sentence, img);
      }
    }
  } catch (e) {
    console.error(e);
    const msg = e.message
      ? e.message.replace(/\[GoogleGenerativeAI Error\]\s*/, '')
      : 'An unknown error occurred. The model might not have been able to generate content for this topic.';
    error.innerHTML = `Something went wrong: ${msg}`;
    error.removeAttribute('hidden');
  } finally {
    userInput.disabled = false;
    userInput.focus();
  }
}

userInput.addEventListener('keydown', async (e: KeyboardEvent) => {
  if (e.code === 'Enter') {
    e.preventDefault();
    const message = userInput.value;
    await generate(message);
  }
});

const examples = document.querySelectorAll('#examples li');
examples.forEach((li) =>
  li.addEventListener('click', async (e) => {
    await generate(li.textContent);
  }),
);
