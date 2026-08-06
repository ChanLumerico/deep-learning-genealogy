// ═══════════════════════════════════════════════════════════════════════════
// READING LIST · papers keyed by node.
//
// PAPERS is reference data: the canonical title shown under every model in the
// reading list. It is NOT reading state, and this file ships no reading state
// of any kind — a visitor starts with nothing read, and the list only ever
// grows from their own ticks or a CSV they upload (see readingLog.ts, csv.ts).
// ═══════════════════════════════════════════════════════════════════════════

export const PAPERS: Record<string, string> = {
  alexnet: 'ImageNet Classification with Deep Convolutional Neural Networks',
  vgg: 'Very Deep Convolutional Networks for Large-Scale Image Recognition',
  googlenet: 'Going Deeper with Convolutions',
  inceptionv3: 'Rethinking the Inception Architecture for Computer Vision',
  inceptionv4: 'Inception-v4, Inception-ResNet and the Impact of Residual Connections on Learning',
  resnet: 'Deep Residual Learning for Image Recognition',
  resnext: 'Aggregated Residual Transformations for Deep Neural Networks',
  senet: 'Squeeze-and-Excitation Networks',
  sknet: 'Selective Kernel Networks',
  densenet: 'Densely Connected Convolutional Networks',
  xception: 'Xception: Deep Learning With Depthwise Separable Convolutions',
  mobilenet: 'MobileNets: Efficient Convolutional Neural Networks for Mobile Vision Applications',
  mbv2: 'MobileNetV2: Inverted Residuals and Linear Bottlenecks',
  mbv3: 'Searching for MobileNetV3',
  mbv4: 'MobileNet-v4: Advancing Efficiency for Mobile Vision',
  efficientnet: 'EfficientNet: Rethinking Model Scaling for Convolutional Neural Networks',
  effnetv2: 'EfficientNetV2: Smaller Models and Faster Training',
  resnest: 'ResNeSt: Split-Attention Networks',
  convnext: 'A ConvNet for the 2020s',
  convnext2: 'ConvNeXt V2: Co-designing and Scaling ConvNets with Masked Autoencoders',
  inceptionnext: 'InceptionNeXt: When Inception Meets ConvNeXt',
  coatnet: 'CoAtNet: Marrying Convolution and Attention for All Data Sizes',
  cspnet: 'CSPNet: A New Backbone that can Enhance Learning Capability of CNN',
  vit: 'An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale',
  swin: 'Swin Transformer: Hierarchical Vision Transformer using Shifted Windows',
  swin2: 'Swin Transformer V2: Scaling Up Capacity and Resolution',
  cvt: 'CvT: Introducing Convolutions to Vision Transformers',
  pvt: 'Pyramid Vision Transformer: A Versatile Backbone for Dense Prediction without Convolutions',
  pvt2: 'PVTv2: Improved Baselines with Pyramid Vision Transformer',
  crossvit: 'CrossViT: Cross-Attention Multi-Scale Vision Transformer for Image Classification',
  maxvit: 'MaxViT: Multi-Axis Vision Transformer',
  efficientformer: 'EfficientFormer: Vision Transformers at MobileNet Speed',
  transformer: 'Attention Is All You Need',
  bert: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
  roformer: 'RoFormer: Enhanced Transformer with Rotary Position Embedding',
  rcnn: 'Rich Feature Hierarchies for Accurate Object Detection and Semantic Segmentation',
  fastrcnn: 'Fast R-CNN',
  fasterrcnn: 'Faster R-CNN: Towards Real-Time Object Detection with Region Proposal Networks',
  yolo: 'You Only Look Once: Unified, Real-Time Object Detection',
  yolov2: 'YOLO9000: Better, Faster, Stronger',
  yolov3: 'YOLOv3: An Incremental Improvement',
  yolov4: 'YOLOv4: Optimal Speed and Accuracy of Object Detection',
  effdet: 'EfficientDet: Scalable and Efficient Object Detection',
  detr: 'End-to-End Object Detection with Transformers',
  vae: 'Auto-Encoding Variational Bayes',
  ddpm: 'Denoising Diffusion Probabilistic Models',
  ncsn: 'Generative Modeling by Estimating Gradients of the Data Distribution',
  maskrcnn: 'Mask R-CNN',
  maskformer: 'Per-Pixel Classification is Not All You Need for Semantic Segmentation',
  mask2former: 'Masked-attention Mask Transformer for Universal Image Segmentation',
  unet: 'U-Net: Convolutional Networks for Biomedical Image Segmentation',
  attnunet: 'Attention U-Net: Learning Where to Look for the Pancreas',
  dqn: 'Human-level Control through Deep Reinforcement Learning',
  ddqn: 'Deep Reinforcement Learning with Double Q-learning',
  dueling: 'Dueling Network Architectures for Deep Reinforcement Learning',
  ac: 'Policy Gradient Methods for Reinforcement Learning with Function Approximation',
  trpo: 'Trust Region Policy Optimization',
  ppo: 'Proximal Policy Optimization Algorithms',
  dagger: 'A Reduction of Imitation Learning and Structured Prediction to No-Regret Online Learning',
  apprentice: 'Apprenticeship Learning via Inverse Reinforcement Learning',
  maxentirl: 'Maximum Entropy Inverse Reinforcement Learning',
  gail: 'Generative Adversarial Imitation Learning',
  dpo: 'Direct Preference Optimization: Your Language Model is Secretly a Reward Model',
  grpo: 'DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models',
  instructgpt: 'Training Language Models to Follow Instructions with Human Feedback',
  nice: 'NICE: Non-linear Independent Components Estimation',
  realnvp: 'Density Estimation using Real NVP',
  maf: 'Masked Autoregressive Flow for Density Estimation',
  nde: 'Neural Ordinary Differential Equations',
  flowmatch: 'Flow Matching for Generative Modeling',
  rectflow: 'Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow',
}

// CSV model names that don't normalise onto a node name by themselves
export const CSV_ALIASES: Record<string, string> = {
  vggnet: 'vgg', inceptionv4resnet: 'inceptionv4', mobilenetv2: 'mbv2', mobilenetv3: 'mbv3',
  mobilenetv4: 'mbv4', efficientnetv2: 'effnetv2', convnextv2: 'convnext2', inceptionv3: 'inceptionv3',
  swintransformer: 'swin', swintransformerv2: 'swin2', pvtv2: 'pvt2', yolov1: 'yolo', yolov2: 'yolov2',
  yolov3: 'yolov3', yolov4: 'yolov4', yolov5: 'yolov4', yolov8: 'yolov4', policygradient: 'ac',
  efficientdet: 'effdet', attentionunet: 'attnunet', neuralode: 'nde', flowmatching: 'flowmatch',
  realnvp: 'realnvp', rectifiedflow: 'rectflow', apprenticeshiplearning: 'apprentice', maxentirl: 'maxentirl', ddqn: 'ddqn',
  doubledqn: 'ddqn', duelingdqn: 'dueling', wordvec: 'w2v', word2vec: 'w2v', gpt3: 'gpt3', gpt2: 'gpt2',
  stablediffusion: 'ldm', latentdiffusion: 'ldm', llama: 'llama', llama2: 'llama2', llama3: 'llama2',
  vitvisiontransformer: 'vit', maskrcnn: 'maskrcnn', fastrcnn: 'fastrcnn', fasterrcnn: 'fasterrcnn',
  // written-out names, which a hand-kept list uses more often than the acronym
  visiontransformer: 'vit', inceptionv1: 'googlenet', deepqnetwork: 'dqn',
  variationalautoencoder: 'vae', longshorttermmemory: 'lstm', gatedrecurrentunit: 'gru',
  generativeadversarialnetwork: 'gan', proximalpolicyoptimization: 'ppo',
  trustregionpolicyoptimization: 'trpo', softactorcritic: 'sac',
  deterministicpolicygradient: 'dpg', denoisingdiffusion: 'ddpm',
  scorebasedsde: 'scoresde', scoresde: 'scoresde', maskedautoregressiveflow: 'maf',
}

/**
 * The columns Export writes. Import does not require them — it recognises
 * `doi`, `arxiv`, `title`/`paper` and `model` wherever they appear — but a
 * file written here carries the identifiers that make a re-import exact.
 */
export const CSV_HEADER = ['Model', 'Field', 'Paper', 'DOI', 'arXiv', 'Task', 'Year']
